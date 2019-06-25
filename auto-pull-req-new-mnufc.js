"use strict";
"use latest";
var __importDefault =
  (this && this.__importDefault) ||
  function(mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
var __importStar =
  (this && this.__importStar) ||
  function(mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null)
      for (var k in mod)
        if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
  };
Object.defineProperty(exports, "__esModule", { value: true });
const request_promise_native_1 = __importDefault(
  require("request-promise-native")
);
const lodash_1 = __importDefault(require("lodash"));
const cheerio = __importStar(require("cheerio"));
const bluebird_1 = __importDefault(require("bluebird"));
const rest_1 = __importDefault(require("@octokit/rest"));
const url_1 = require("url");
/**
 * @param context {WebtaskContext}
 */
async function start(context, cb) {
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
hidden: true
---`,
    iframeTemplate: `<div class='soccer-video-wrapper'>
    <iframe class='soccer-video' width='100%' height='auto' frameborder='0' allowfullscreen src="https://www.mnufc.com/iframe-video?brightcove_id={replaceMe}&brightcove_player_id=default&brightcove_account_id=5534894110001"></iframe>
  </div>`
  };
  let highlightArray = [];
  let videoPromises = [];
  const cheerioHighlightBody = await request_promise_native_1.default({
    uri: `${options.highlightHost}/videos/match-highlights`,
    transform: function(body) {
      return cheerio.load(body);
    }
  });
  //crawl the page and get all the nodes for each highlight video
  lodash_1.default.map(
    cheerioHighlightBody(".views-row .node"),
    function mapTheNodes(node) {
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
      let permalink = lodash_1.default.snakeCase(filename);
      let localHightlight = new Highlight({
        filename: filename,
        title: title,
        postUrl: postUrl,
        date: date,
        permalink: permalink
      });
      highlightArray.push(localHightlight);
    }
  );
  //After we get all the nodes for the videos we need to fetch the post page for the video url itself
  lodash_1.default.forEach(highlightArray, function forEachHighlight(
    highlight
  ) {
    const vidProm = request_promise_native_1.default({
      uri: options.highlightHost + highlight.postUrl,
      transform: function transformTheBody(body) {
        return cheerio.load(body);
      }
    });
    videoPromises.push(vidProm);
  });
  //after all the videos come back lets add it to the highlight array and then send it to GH
  const videos = await bluebird_1.default.all(videoPromises);
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
async function SendNewFilesToGitHubRepo(options, context, allHighlights) {
  const octokit = new rest_1.default({
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
  let newPosts = lodash_1.default.differenceWith(
    allHighlights,
    previousUnitedPosts,
    function checkPreviousPostVsNew(mnufcValue, githubObject) {
      return mnufcValue.filename === githubObject.name;
    }
  );
  const refParams = {
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
    const newBranchName = `refs/heads/${lodash_1.default.snakeCase(
      post.title
    )}`;
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
    const pullParams = {
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
  constructor(initObject) {
    this.filename = initObject.filename || "";
    this.title = initObject.title || "";
    this.postUrl = initObject.postUrl || new url_1.URL("https://google.com");
    this.date = initObject.date || new Date();
    this.permalink = initObject.permalink || "";
    this.video = initObject.video || "";
    this.excerpt = initObject.excerpt || "";
  }
}
