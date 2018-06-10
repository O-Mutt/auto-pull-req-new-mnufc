

'use latest';

const request = require('request');
const rp = require('request-promise-native');
const _ = require('lodash');
const cheerio = require('cheerio');
const Promises = require('bluebird');
const hostname = 'https://www.mnufc.com'

let postHeader = `author: Matt Erickson (ME)
layout: post
categories:
  - MNUFC
  - Auto-post
tags:
  - MNUFC
  - Soccer
---`


let iframeUrlTemplate = `<div class='soccer-video-wrapper'>\r\n<iframe class='soccer-video' width='100%' height='auto' frameborder='0' allowfullscreen src="https://www.mnufc.com/iframe-video?brightcove_id={replaceMe}&brightcove_player_id=default&brightcove_account_id=5534894110001"></iframe>\r\n</div>`;

/**
 * @param context {WebtaskContext}
 */
module.exports = function(context, cb) {
    let highlightArray = [];
    let videoPromises = [];
    rp({
        uri: hostname + '/video-channels/match-highlights',
        transform: function(body) {
            return cheerio.load(body);
        }
      }).then(function($) { 
        //crawl the page and get all the nodes for each highlight video
        _.map($(".views-row .node"), function(node) {
            let highlight = $(node).find('.node-title a');
            
            //Remove unneeded parts of the title that make things look weird
            let title = highlight.text().replace('HIGHLIGHTS: ', '').replace(/\'/gi, '');
            let titleWithoutEndDate = title.replace(/\|.*/gi, '').replace('\.', '');
            let titleWOEDAndSpaces = titleWithoutEndDate.replace(/\s/gi, '-').replace(/\-$/, '');
            let postUrl = highlight.attr('href');
            var date =  new Date($(node).find('.timestamp').text().replace(/\s\(.*\)/gi, ''));
            let filename = date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate() + '-' + titleWOEDAndSpaces + '.md';
            let permalink = _.snakeCase(filename);
            
            highlightArray.push({ 
              filename: filename,
              title: title, 
              postUrl: postUrl, 
              date: date,
              permalink: permalink
            });
        });

        //After we get all the nodes for the videos we need to fetch the post page for the video url itself
        _.forEach(highlightArray, function(highlight) {
            var vidProm = rp({
                uri: hostname + highlight.postUrl,
                transform: function(body) {
                    return cheerio.load(body);
                }
            });
            videoPromises.push(vidProm);
        });

        //after all the videos come back lets add it to the highlight array and then send it to GH
        Promises.all(videoPromises).then(function(videos) {
            for (var i = 0; i < highlightArray.length; i++) {
              let videoHtml = iframeUrlTemplate.replace('{replaceMe}', videos[i]('video').attr('data-video-id'));
              let excerptText = videos[i]('.node .field-type-text-long p') .text()
              highlightArray[i].video = videoHtml;
              highlightArray[i].excerpt = excerptText; 
            }
            SendNewFilesToGitHubRepo(highlightArray);
        });
    });

  function SendNewFilesToGitHubRepo(allHighlights) {
    rp({
      qs: {
        access_token: context.secrets.GITHUB_ACCESS_TOKEN
      },
      headers: {
        'User-Agent': 'MN UFC auto blogger'
      },
      json: true,
      uri: `https://api.github.com/repos/Mutmatt/mutmatt.github.io/contents/_posts/mnufc/`
    }).then(function(response) {
      //We don't want to recreate old files so we will diff the two arrays
      let newPosts = _.differenceWith(allHighlights, response, function(mnufcValue, githubObject) {
        return mnufcValue.filename == githubObject.name;
      });
      
      var ghPromises = [];
      //Create the header for the markdown
      _.forEach(newPosts, function(post) {
        var postText = `---\r\ntitle: ${post.title}\r\ndate: ${post.date}\r\npermalink: /${post.permalink}\r\nexcerpt:${post.excerpt}\r\n${postHeader}\r\n${post.video}`;

        // Send each new file to the github triggering jekyll rebuild/deploy to the site
        ghPromises.push(rp.put({
          qs: {
            access_token: context.secrets.GITHUB_ACCESS_TOKEN
          },
          headers: {
            'User-Agent': 'MN UFC auto blogger'
          },
          json: true,
          method: 'PUT',
          uri: `https://api.github.com/repos/Mutmatt/mutmatt.github.io/contents/_posts/mnufc/` + post.filename,
          body: {
            path: '_posts/mnufc',
            message: post.title,
            content: Buffer.from(postText).toString('base64')
          }
        })
      );
      });
      
      //After all github files are created return the new posts
      Promises.all(ghPromises).then(function () {
        cb(null, { newPosts });  
      });
    });
  }
};