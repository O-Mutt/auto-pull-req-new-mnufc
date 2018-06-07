'use latest';

const request = require('request');
const rp = require('request-promise-native');
const _ = require('lodash');
const cheerio = require('cheerio');
const Promises = require('bluebird');
const hostname = 'https://www.mnufc.com'
let iframeUrlTemplate = `<div class='fluid-width-video-wrapper'><iframe width='100%' height='auto' frameborder='0' allowfullscreen src='https://www.mnufc.com/iframe-video?brightcove_id=`;
let iframUrlTemplatePt2 = `&brightcove_player_id=default&brightcove_account_id=5534894110001'></iframe></div>`;

/**
 * @param context {WebtaskContext}
 */
module.exports = function(context, cb) {

    var highlightArray = [];
    rp({
        uri: hostname + '/video-channels/match-highlights',
        transform: function(body) {
            return cheerio.load(body);
        }
    }).then(function($) {
        //data process 
        var videoPromises = [];
        _.forEach($(".views-row .node"), function(node) {
          console.log("fffuuuu");
            let highlight = node.find('.node-title a');
            let title = highlight.text();
            console.log(title);
            let postUrl = highlight.attr('href');
            var date = $(node)('.timestamp').text();
            highlight = $(highlight);
            highlightArray.push({ title: title, postUrl: postUrl, date: date });
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
            for (var i = 0; i < highlightArray.length - 1; i++) {
                highlightArray[i].video = iframeUrlTemplate + videos[i]('video').attr('data-video-id') + iframUrlTemplatePt2;
            }

            //outputHighlightPostFile(highlightArray[0])
            cb(null, { highlights: highlightArray });
        });
    });

    //cb(null, { theDom });
};