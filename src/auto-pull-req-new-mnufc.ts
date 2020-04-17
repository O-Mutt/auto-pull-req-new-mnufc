import rp from 'request-promise-native';
import _ from 'lodash';
import * as cheerio from 'cheerio';
import Promises from 'bluebird';
import { Highlight } from './highlight';
import { SendNewFilesToGitHubRepo } from './SendFilesToGitHub';

/**
 * @param context { Lambda Context}
 */
async function start(context: any) {
  const options = {
    highlightHost: 'https://www.mnufc.com',
    owner: 'Mutmatt',
    repo: 'mutmatt.github.io',
    postHeader: `author: Matt Erickson (ME)
layout: post
tags:
  - mnufc
  - soccer
  - auto-post
hidden: true
---`,
    iframeTemplate: `<div class='soccer-video-wrapper'>
    <iframe class='soccer-video' width='100%' height='auto' frameborder='0' allowfullscreen src='https://www.mnufc.com/iframe-video?brightcove_id={replaceMe}&brightcove_player_id=default&brightcove_account_id=5534894110001'></iframe>
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
  _.map(cheerioHighlightBody('.views-row .node'), function mapTheNodes(
    node: any
  ) {
    const highlightHtml = cheerioHighlightBody(node).find('.node-title a');

    //Remove unneeded parts of the title that make things look weird
    const title = highlightHtml
      .text()
      .replace('HIGHLIGHTS: ', '')
      .replace(/\'/gi, '');

    const titleWithoutEndDate = title.replace(/\|.*/gi, '').replace('.', '');

    const titleWOEDAndSpaces = titleWithoutEndDate
      .replace(/\s/gi, '-')
      .replace(/\-$/, '');

    const postUrl = highlightHtml.attr('href');

    const date = new Date(
      cheerioHighlightBody(node)
        .find('.timestamp')
        .text()
        .replace(/\s\(.*\)/gi, '')
    );

    let filename =
      date.getFullYear() +
      '-' +
      (date.getMonth() + 1) +
      '-' +
      date.getDate() +
      '-' +
      titleWOEDAndSpaces +
      '.md';

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
      '{replaceMe}',
      videos[i]('video').attr('data-video-id')
    );
    let excerptText = videos[i]('.node .field-type-text-long p').text();
    highlightArray[i].video = videoHtml;
    highlightArray[i].excerpt = excerptText;
  }

  const newPosts = await SendNewFilesToGitHubRepo(
    options,
    context,
    highlightArray
  );

  return newPosts;
}

export default start;

