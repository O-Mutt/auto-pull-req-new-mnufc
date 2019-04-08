"use latest";

import rp from "request-promise-native";
import _ from "lodash";
import * as cheerio from "cheerio";
import Promises from "bluebird";
import Octokit, { GitGetRefParams, PullsCreateParams } from "@octokit/rest";
import { Url, URL } from "url";

/**
 * @param context {WebtaskContext}
 */
async function start(context: any, cb: Function) {
  const options = {
    highlightHost: "https://www.mnufc.com",
    owner: "Mutmatt",
    repo: "mutmatt.github.io",
    postHeader: `author: Matt Erickson (ME)
layout: post
tags:
  - mnufc
  - soccer
  - auto-post
---`,
    iframeTemplate: `<div class='soccer-video-wrapper'>
    <iframe class='soccer-video' width='100%' height='auto' frameborder='0' allowfullscreen src="https://www.mnufc.com/iframe-video?brightcove_id={replaceMe}&brightcove_player_id=default&brightcove_account_id=5534894110001"></iframe>
  </div>`
  };

  let highlightArray: Highlight[] = [];
  let videoPromises: any[] = [];
  const cheerioHighlightBody = await rp({
    uri: `${options.highlightHost}/videos/match-highlights`,
    transform: function(body: any) {
      return cheerio.load(body);
    }
  });

  //crawl the page and get all the nodes for each highlight video
  _.map(cheerioHighlightBody(".views-row .node"), function mapTheNodes(
    node: any
  ) {
    const highlightHtml = cheerioHighlightBody(node).find(".node-title a");

    //Remove unneeded parts of the title that make things look weird
    const title = highlightHtml
      .text()
      .replace("HIGHLIGHTS: ", "")
      .replace(/\'/gi, "");

    const titleWithoutEndDate = title.replace(/\|.*/gi, "").replace(".", "");

    const titleWOEDAndSpaces = titleWithoutEndDate
      .replace(/\s/gi, "-")
      .replace(/\-$/, "");

    const postUrl = highlightHtml.attr("href");

    const date = new Date(
      cheerioHighlightBody(node)
        .find(".timestamp")
        .text()
        .replace(/\s\(.*\)/gi, "")
    );

    let filename =
      date.getFullYear() +
      "-" +
      (date.getMonth() + 1) +
      "-" +
      date.getDate() +
      "-" +
      titleWOEDAndSpaces +
      ".md";

    let permalink = _.snakeCase(filename);

    let localHightlight = new Highlight({
      filename: filename,
      title: title,
      postUrl: postUrl,
      date: date,
      permalink: permalink
    });

    highlightArray.push(localHightlight);
  });

  //After we get all the nodes for the videos we need to fetch the post page for the video url itself
  _.forEach(highlightArray, function forEachHighlight(highlight) {
    const vidProm = rp({
      uri: options.highlightHost + highlight.postUrl,
      transform: function transformTheBody(body) {
        return cheerio.load(body);
      }
    });
    videoPromises.push(vidProm);
  });

  //after all the videos come back lets add it to the highlight array and then send it to GH
  const videos = await Promises.all(videoPromises);

  for (var i = 0; i < highlightArray.length; i++) {
    let videoHtml = options.iframeTemplate.replace(
      "{replaceMe}",
      videos[i]("video").attr("data-video-id")
    );
    let excerptText = videos[i](".node .field-type-text-long p").text();
    highlightArray[i].video = videoHtml;
    highlightArray[i].excerpt = excerptText;
  }

  const newPosts = await SendNewFilesToGitHubRepo(
    options,
    context,
    highlightArray
  );

  cb(null, { newPosts });
}

async function SendNewFilesToGitHubRepo(
  options: any,
  context: any,
  allHighlights: Highlight[]
) {
  const octokit = new Octokit({
    auth: `${context.secrets.GITHUB_ACCESS_TOKEN}`
  });

  let previousUnitedPosts = [];
  try {
    const postsRequest = await octokit.repos.getContents({
      owner: options.owner,
      repo: options.repo,
      path: `_posts/mnufc`,
      ref: `heads/master`
    });
    previousUnitedPosts = postsRequest.data;
  } catch (e) {
    //error occured because we can't get the old posts
  }

  //We don't want to recreate old files so we will diff the two arrays
  let newPosts = _.differenceWith(
    allHighlights,
    previousUnitedPosts,
    function checkPreviousPostVsNew(mnufcValue: Highlight, githubObject: any) {
      return mnufcValue.filename === githubObject.name;
    }
  );

  const refParams: GitGetRefParams = {
    owner: options.owner,
    repo: options.repo,
    ref: `heads/master`
  };
  const masterData = await octokit.git.getRef(refParams);

  const masterSha = masterData.data.object.sha;
  for (let post of newPosts) {
    const postText = `---
  title: ${post.title}
  date: ${post.date}
  permalink: ${post.permalink}
  excerpt: ${post.excerpt}
${options.postHeader}
${post.video}`;

    const newBranchName = `refs/heads/${_.snakeCase(post.title)}`;
    // Send each new file to the github triggering jekyll rebuild/deploy to the site
    try {
      await octokit.git.createRef({
        owner: options.owner,
        repo: options.repo,
        ref: newBranchName,
        sha: masterSha
      });
    } catch (e) {
      //don't really care about a failure as it is probably just `already exists`
    }

    await octokit.repos.createFile({
      owner: options.owner,
      repo: options.repo,
      path: `_posts/mnufc/${post.filename}`,
      message: post.title || "Default MNUFC hightlight",
      content: Buffer.from(postText).toString("base64"),
      branch: newBranchName
    });

    const pullParams: PullsCreateParams = {
      owner: options.owner,
      repo: options.repo,
      title: post.title || `Default MNUFC Highlight`,
      base: `master`,
      head: newBranchName
    };
    const result = await octokit.pulls.create(pullParams);
  }

  return newPosts;
}

module.exports = start;

class Highlight {
  filename: string | undefined;
  title: string | undefined;
  postUrl: Url | undefined;
  date: Date | undefined;
  permalink: string | undefined;
  video: string | undefined;
  excerpt: string | undefined;

  constructor(initObject: any) {
    this.filename = initObject.filename || "";
    this.title = initObject.title || "";
    this.postUrl = initObject.postUrl || new URL("https://google.com");
    this.date = initObject.date || new Date();
    this.permalink = initObject.permalink || "";
    this.video = initObject.video || "";
    this.excerpt = initObject.excerpt || "";
  }
}
