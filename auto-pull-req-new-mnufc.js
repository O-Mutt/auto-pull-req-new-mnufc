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
/**
 * @param context {WebtaskContext}
 */
async function start(context, cb) {
  const options = {
    highlightHost: "https://www.mnufc.com",
    author: "Mutmatt",
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
  const octokit = new rest_1.default();
  let highlightArray = [];
  let videoPromises = [];
  const cheerioHighlightBody = await request_promise_native_1.default({
    uri: `${options.highlightHost}/video-channels/match-highlights`,
    transform: function(body) {
      return cheerio.load(body);
    }
  });
  //crawl the page and get all the nodes for each highlight video
  lodash_1.default.map(cheerioHighlightBody(".views-row .node"), function(
    node
  ) {
    let highlight = cheerioHighlightBody(node).find(".node-title a");
    //Remove unneeded parts of the title that make things look weird
    let title = highlight
      .text()
      .replace("HIGHLIGHTS: ", "")
      .replace(/\'/gi, "");
    let titleWithoutEndDate = title.replace(/\|.*/gi, "").replace(".", "");
    let titleWOEDAndSpaces = titleWithoutEndDate
      .replace(/\s/gi, "-")
      .replace(/\-$/, "");
    let postUrl = highlight.attr("href");
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
    let permalink = lodash_1.default.snakeCase(filename);
    highlightArray.push({
      filename: filename,
      title: title,
      postUrl: postUrl,
      date: date,
      permalink: permalink
    });
  });
  //After we get all the nodes for the videos we need to fetch the post page for the video url itself
  lodash_1.default.forEach(highlightArray, function(highlight) {
    var vidProm = request_promise_native_1.default({
      uri: options.highlightHost + highlight.postUrl,
      transform: function(body) {
        return cheerio.load(body);
      }
    });
    videoPromises.push(vidProm);
  });
  //after all the videos come back lets add it to the highlight array and then send it to GH
  const videos = await bluebird_1.default.all(videoPromises);
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
  await SendNewFilesToGitHubRepo(highlightArray);
  async function SendNewFilesToGitHubRepo(allHighlights) {
    const previousMNUFCPosts = await request_promise_native_1.default({
      qs: {
        //@ts-ignore
        access_token: context.secrets.GITHUB_ACCESS_TOKEN
      },
      headers: {
        "User-Agent": "MN UFC auto blogger"
      },
      json: true,
      uri: `https://api.github.com/repos/Mutmatt/mutmatt.github.io/contents/_posts/mnufc/`
    });
    console.log(
      "send to github",
      allHighlights.length,
      previousMNUFCPosts.length
    );
    //We don't want to recreate old files so we will diff the two arrays
    let newPosts = lodash_1.default.differenceWith(
      allHighlights,
      previousMNUFCPosts,
      function(mnufcValue, githubObject) {
        console.log(
          "comparing the filenames ",
          mnufcValue.filename === githubObject.name
        ); //mnufcValue.filename, githubObject.name);
        return false;
      }
    );
    console.log("new posts coming in", newPosts.length);
    let ghPromises = [];
    //Create the header for the markdown
    await lodash_1.default.forEach(newPosts, async function(post) {
      var postText = `---
  title: ${post.title}
  date: ${post.date}
  permalink: ${post.permalink}
  excerpt: ${post.excerpt}
  ${options.postHeader}
  ${post.video}`;
      // Send each new file to the github triggering jekyll rebuild/deploy to the site
      console.log("we gotta iterate over the new posts");
      //const shaVal = crypto.createHash('sha1').update(`refs/heads/${post.date.toString()}`).digest('hex');
      console.log("nerd alert \r\n \r\n");
      const masterData = await octokit.gitdata.getReference({
        owner: options.author,
        repo: options.repo,
        ref: `heads/master`
      });
      const masterSha = masterData.data.object.sha;
      console.log(masterSha);
      console.log("hello world \r\n \r\n");
      const result = await octokit.gitdata.createReference({
        owner: options.author,
        repo: options.repo,
        ref: `refs/heads/${post.date.toString()}`,
        sha: masterSha
      });
      console.log("hey look github took my request", result);
      ghPromises.push(
        request_promise_native_1.default.put({
          qs: {
            access_token: context.secrets.GITHUB_ACCESS_TOKEN
          },
          headers: {
            "User-Agent": "MN UFC auto blogger"
          },
          json: true,
          method: "PUT",
          uri: `https://api.github.com/repos/Mutmatt/mutmatt.github.io/contents/_posts/mnufc/${
            post.filename
          }`,
          body: {
            path: "_posts/mnufc",
            message: post.title,
            content: Buffer.from(postText).toString("base64")
          }
        })
      );
    });
    //After all github files are created return the new posts
    //await Promises.all(ghPromises)
    cb(null, { newPosts });
  }
}
module.exports = start;
