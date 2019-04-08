"use strict";
"use latest";
var __awaiter =
  (this && this.__awaiter) ||
  function(thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function(resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator["throw"](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done
          ? resolve(result.value)
          : new P(function(resolve) {
              resolve(result.value);
            }).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
var __generator =
  (this && this.__generator) ||
  function(thisArg, body) {
    var _ = {
        label: 0,
        sent: function() {
          if (t[0] & 1) throw t[1];
          return t[1];
        },
        trys: [],
        ops: []
      },
      f,
      y,
      t,
      g;
    return (
      (g = { next: verb(0), throw: verb(1), return: verb(2) }),
      typeof Symbol === "function" &&
        (g[Symbol.iterator] = function() {
          return this;
        }),
      g
    );
    function verb(n) {
      return function(v) {
        return step([n, v]);
      };
    }
    function step(op) {
      if (f) throw new TypeError("Generator is already executing.");
      while (_)
        try {
          if (
            ((f = 1),
            y &&
              (t =
                op[0] & 2
                  ? y["return"]
                  : op[0]
                  ? y["throw"] || ((t = y["return"]) && t.call(y), 0)
                  : y.next) &&
              !(t = t.call(y, op[1])).done)
          )
            return t;
          if (((y = 0), t)) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (
                !((t = _.trys), (t = t.length > 0 && t[t.length - 1])) &&
                (op[0] === 6 || op[0] === 2)
              ) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
      if (op[0] & 5) throw op[1];
      return { value: op[0] ? op[1] : void 0, done: true };
    }
  };
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
exports.__esModule = true;
var request_promise_native_1 = __importDefault(
  require("request-promise-native")
);
var lodash_1 = __importDefault(require("lodash"));
var cheerio = __importStar(require("cheerio"));
var bluebird_1 = __importDefault(require("bluebird"));
var rest_1 = __importDefault(require("@octokit/rest"));
var url_1 = require("url");
/**
 * @param context {WebtaskContext}
 */
function start(context, cb) {
  return __awaiter(this, void 0, void 0, function() {
    var options,
      highlightArray,
      videoPromises,
      cheerioHighlightBody,
      videos,
      i,
      videoHtml,
      excerptText,
      newPosts;
    return __generator(this, function(_a) {
      switch (_a.label) {
        case 0:
          options = {
            highlightHost: "https://www.mnufc.com",
            owner: "Mutmatt",
            repo: "mutmatt.github.io",
            postHeader:
              "author: Matt Erickson (ME)\nlayout: post\ntags:\n  - mnufc\n  - soccer\n  - auto-post\n---",
            iframeTemplate:
              "<div class='soccer-video-wrapper'>\n    <iframe class='soccer-video' width='100%' height='auto' frameborder='0' allowfullscreen src=\"https://www.mnufc.com/iframe-video?brightcove_id={replaceMe}&brightcove_player_id=default&brightcove_account_id=5534894110001\"></iframe>\n  </div>"
          };
          highlightArray = [];
          videoPromises = [];
          return [
            4 /*yield*/,
            request_promise_native_1["default"]({
              uri: options.highlightHost + "/videos/match-highlights",
              transform: function(body) {
                return cheerio.load(body);
              }
            })
          ];
        case 1:
          cheerioHighlightBody = _a.sent();
          //crawl the page and get all the nodes for each highlight video
          lodash_1["default"].map(
            cheerioHighlightBody(".views-row .node"),
            function(node) {
              var highlightHtml = cheerioHighlightBody(node).find(
                ".node-title a"
              );
              //Remove unneeded parts of the title that make things look weird
              var title = highlightHtml
                .text()
                .replace("HIGHLIGHTS: ", "")
                .replace(/\'/gi, "");
              var titleWithoutEndDate = title
                .replace(/\|.*/gi, "")
                .replace(".", "");
              var titleWOEDAndSpaces = titleWithoutEndDate
                .replace(/\s/gi, "-")
                .replace(/\-$/, "");
              var postUrl = highlightHtml.attr("href");
              var date = new Date(
                cheerioHighlightBody(node)
                  .find(".timestamp")
                  .text()
                  .replace(/\s\(.*\)/gi, "")
              );
              var filename =
                date.getFullYear() +
                "-" +
                (date.getMonth() + 1) +
                "-" +
                date.getDate() +
                "-" +
                titleWOEDAndSpaces +
                ".md";
              var permalink = lodash_1["default"].snakeCase(filename);
              var localHightlight = new Highlight({
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
          lodash_1["default"].forEach(highlightArray, function(highlight) {
            var vidProm = request_promise_native_1["default"]({
              uri: options.highlightHost + highlight.postUrl,
              transform: function(body) {
                return cheerio.load(body);
              }
            });
            videoPromises.push(vidProm);
          });
          return [4 /*yield*/, bluebird_1["default"].all(videoPromises)];
        case 2:
          videos = _a.sent();
          for (i = 0; i < highlightArray.length; i++) {
            videoHtml = options.iframeTemplate.replace(
              "{replaceMe}",
              videos[i]("video").attr("data-video-id")
            );
            excerptText = videos[i](".node .field-type-text-long p").text();
            highlightArray[i].video = videoHtml;
            highlightArray[i].excerpt = excerptText;
          }
          return [
            4 /*yield*/,
            SendNewFilesToGitHubRepo(options, context, highlightArray)
          ];
        case 3:
          newPosts = _a.sent();
          cb(null, { newPosts: newPosts });
          return [2 /*return*/];
      }
    });
  });
}
function SendNewFilesToGitHubRepo(options, context, allHighlights) {
  return __awaiter(this, void 0, void 0, function() {
    var octokit,
      previousUnitedPosts,
      postsRequest,
      e_1,
      newPosts,
      masterData,
      masterSha,
      _i,
      newPosts_1,
      post,
      postText,
      newBranchName,
      e_2,
      result;
    return __generator(this, function(_a) {
      switch (_a.label) {
        case 0:
          octokit = new rest_1["default"]();
          octokit.authenticate({
            type: "oauth",
            token: context.secrets.GITHUB_ACCESS_TOKEN
          });
          previousUnitedPosts = [];
          _a.label = 1;
        case 1:
          _a.trys.push([1, 3, , 4]);
          return [
            4 /*yield*/,
            octokit.repos.getContents({
              owner: options.owner,
              repo: options.repo,
              path: "_posts/mnufc",
              ref: "heads/master"
            })
          ];
        case 2:
          postsRequest = _a.sent();
          previousUnitedPosts = postsRequest.data;
          return [3 /*break*/, 4];
        case 3:
          e_1 = _a.sent();
          return [3 /*break*/, 4];
        case 4:
          newPosts = lodash_1["default"].differenceWith(
            allHighlights,
            previousUnitedPosts,
            function(mnufcValue, githubObject) {
              return mnufcValue.filename === githubObject.name;
            }
          );
          return [
            4 /*yield*/,
            octokit.git.getRef({
              owner: options.owner,
              repo: options.repo,
              ref: "heads/master"
            })
          ];
        case 5:
          masterData = _a.sent();
          masterSha = masterData.data.object.sha;
          (_i = 0), (newPosts_1 = newPosts);
          _a.label = 6;
        case 6:
          if (!(_i < newPosts_1.length)) return [3 /*break*/, 14];
          post = newPosts_1[_i];
          postText =
            "---\n  title: " +
            post.title +
            "\n  date: " +
            post.date +
            "\n  permalink: " +
            post.permalink +
            "\n  excerpt: " +
            post.excerpt +
            "\n" +
            options.postHeader +
            "\n" +
            post.video;
          newBranchName =
            "refs/heads/" + lodash_1["default"].snakeCase(post.title);
          _a.label = 7;
        case 7:
          _a.trys.push([7, 9, , 10]);
          return [
            4 /*yield*/,
            octokit.git.createRef({
              owner: options.owner,
              repo: options.repo,
              ref: newBranchName,
              sha: masterSha
            })
          ];
        case 8:
          _a.sent();
          return [3 /*break*/, 10];
        case 9:
          e_2 = _a.sent();
          return [3 /*break*/, 10];
        case 10:
          return [
            4 /*yield*/,
            octokit.repos.createFile({
              owner: options.owner,
              repo: options.repo,
              path: "_posts/mnufc/" + post.filename,
              message: post.title || "Default MNUFC hightlight",
              content: Buffer.from(postText).toString("base64"),
              branch: newBranchName
            })
          ];
        case 11:
          _a.sent();
          return [
            4 /*yield*/,
            octokit.pulls.create({
              owner: options.owner,
              repo: options.repo,
              title: post.title || "Default MNUFC hightlight",
              head: newBranchName,
              base: "master"
            })
          ];
        case 12:
          result = _a.sent();
          _a.label = 13;
        case 13:
          _i++;
          return [3 /*break*/, 6];
        case 14:
          return [2 /*return*/, newPosts];
      }
    });
  });
}
module.exports = start;
var Highlight = /** @class */ (function() {
  function Highlight(initObject) {
    this.filename = initObject.filename || "";
    this.title = initObject.title || "";
    this.postUrl = initObject.postUrl || new url_1.URL("https://google.com");
    this.date = initObject.date || new Date();
    this.permalink = initObject.permalink || "";
    this.video = initObject.video || "";
    this.excerpt = initObject.excerpt || "";
  }
  return Highlight;
})();
