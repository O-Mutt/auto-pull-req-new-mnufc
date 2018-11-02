"use latest";

import rp from "request-promise-native";
import _ from "lodash";
import * as cheerio from "cheerio";
import Promises from "bluebird";
import { default as Octokit } from "@octokit/rest";
import Highlight from "./models/highlight";

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
    uri: `${options.highlightHost}/video-channels/match-highlights`,
    transform: function(body: any) {
      return cheerio.load(body);
    }
  });

  //crawl the page and get all the nodes for each highlight video
  _.map(cheerioHighlightBody(".views-row .node"), function(node: any) {
    let highlightHtml = cheerioHighlightBody(node).find(".node-title a");

    //Remove unneeded parts of the title that make things look weird
    let title = highlightHtml
      .text()
      .replace("HIGHLIGHTS: ", "")
      .replace(/\'/gi, "");

    let titleWithoutEndDate = title.replace(/\|.*/gi, "").replace(".", "");

    let titleWOEDAndSpaces = titleWithoutEndDate
      .replace(/\s/gi, "-")
      .replace(/\-$/, "");

    let postUrl = highlightHtml.attr("href");

    var date = new Date(
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
  _.forEach(highlightArray, function(highlight) {
    var vidProm = rp({
      uri: options.highlightHost + highlight.postUrl,
      transform: function(body) {
        return cheerio.load(body);
      }
    });
    videoPromises.push(vidProm);
  });

  //after all the videos come back lets add it to the highlight array and then send it to GH
  const videos = await Promises.all(videoPromises);

  console.log(
    "checking the videos from the promises back from mnufc",
    videos.length
  );

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
  const octokit = new Octokit();
  octokit.authenticate({
    type: "oauth",
    token: context.secrets.GITHUB_ACCESS_TOKEN
  });

  let previousUnitedPosts = [];
  try {
    const postsRequest = await octokit.repos.getContent({
      owner: options.owner,
      repo: options.repo,
      path: `_posts/mnufc`,
      ref: `heads/master`
    });
    previousUnitedPosts = postsRequest.data;
  } catch (e) {
    //error occured because we can't get the old posts
  }

  console.log(
    "send to github",
    allHighlights.length,
    previousUnitedPosts.length
  );
  //We don't want to recreate old files so we will diff the two arrays
  let newPosts = _.differenceWith(allHighlights, previousUnitedPosts, function(
    mnufcValue: Highlight,
    githubObject: any
  ) {
    console.log(
      "comparing the filenames ",
      mnufcValue.filename === githubObject.name
    ); //mnufcValue.filename, githubObject.name);
    return mnufcValue.filename === githubObject.name;
  });

  const masterData = await octokit.gitdata.getReference({
    owner: options.owner,
    repo: options.repo,
    ref: `heads/master`
  });

  const masterSha = masterData.data.object.sha;
  console.log(masterSha);

  console.log("new posts coming in", newPosts.length);

  for (let post of newPosts) {
    var postText = `---
  title: ${post.title}
  date: ${post.date}
  permalink: ${post.permalink}
  excerpt: ${post.excerpt}
  ${options.postHeader}
  ${post.video}`;

    const newBranchName = `refs/heads/${_.snakeCase(post.title)}`;
    // Send each new file to the github triggering jekyll rebuild/deploy to the site
    try {
      await octokit.gitdata.createReference({
        owner: options.owner,
        repo: options.repo,
        ref: newBranchName,
        sha: masterSha
      });
    } catch (e) {
      //don't really care about a failure as it is probably just `already exists`
    }

    console.log("hey look github took my request", postText);

    await octokit.repos.createFile({
      owner: options.owner,
      repo: options.repo,
      path: `_posts/mnufc/${post.filename}`,
      message: post.title || "Default MNUFC hightlight",
      content: Buffer.from(postText).toString("base64"),
      branch: newBranchName
    });

    const result = await octokit.pullRequests.create({
      owner: options.owner,
      repo: options.repo,
      title: post.title || "Default MNUFC hightlight",
      head: newBranchName,
      base: `master`
    });
  }

  return newPosts;
}

module.exports = start;
