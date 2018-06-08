

'use latest';

const request = require('request');
const rp = require('request-promise-native');
const _ = require('lodash');
const cheerio = require('cheerio');
const Promises = require('bluebird');
const hostname = 'https://www.mnufc.com'

let postHeader = ` 
author: Matt Erickson (ME)
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
        //data process 
        _.map($(".views-row .node"), function(node) {
            let highlight = $(node).find('.node-title a');
            
            let title = highlight.text().replace('HIGHLIGHTS: ', '');
            let titleWithoutEndDate = title.replace(/\|.*/gi, '').replace('\.', '');
            let titleWOEDAndSpaces = titleWithoutEndDate.replace(/\s/gi, '-');
            let postUrl = highlight.attr('href');
            var date =  new Date($(node).find('.timestamp').text().replace(/\s\(.*\)/gi, ''));
            let filename = date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate() + '-' + titleWOEDAndSpaces;
            let permalink = _.snakeCase(filename);
            
            highlightArray.push({ 
              filename: filename,
              title: title, 
              postUrl: postUrl, 
              date: date,
              permalink: permalink
            });
        });

        _.forEach(highlightArray, function(highlight) {
            var vidProm = rp({
                uri: hostname + highlight.postUrl,
                transform: function(body) {
                    return cheerio.load(body);
                }
            });
            videoPromises.push(vidProm);
        });

        Promises.all(videoPromises).then(function(videos) {
            for (var i = 0; i < highlightArray.length; i++) {
              let videoHtml = iframeUrlTemplate.replace('{replaceMe}', videos[i]('video').attr('data-video-id'));
              highlightArray[i].video = videoHtml;
            }
            mapHighlightsToGitHub(highlightArray);
        });
    });

  function mapHighlightsToGitHub(allHighlights) {
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
      let newPosts = _.differenceWith(allHighlights, response, function(mnufcValue, githubObject) {
        return mnufcValue.filename == githubObject.name;
      });
      
      _.forEach(newPosts, function(post) {
        var postText = `---\r\ntitle: ${post.title},\r\ndate: ${post.date},\r\npermalink: /${post.permalink}` + postHeader + '\r\n' + post.video;

        rp.put({
          qs: {
            access_token: context.secrets.GITHUB_ACCESS_TOKEN
          },
          headers: {
            'User-Agent': 'MN UFC auto blogger'
          },
          json: true,
          method: 'PUT',
          uri: `https://api.github.com/repos/Mutmatt/mutmatt.github.io/contents/_posts/mnufc/` + post.filename + '.md',
          body: {
            path: '_posts/mnufc',
            message: post.title,
            content: Buffer.from(postText).toString('base64')
          }
        });
      });
      
      cb(null, { newPosts });
    });
  }
};