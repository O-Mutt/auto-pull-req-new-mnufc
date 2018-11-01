'use latest'

import rp from 'request-promise-native'
import _ from 'lodash'
import * as cheerio from 'cheerio'
import Promises from 'bluebird'
import { default as Octokit } from '@octokit/rest'
import crypto from 'crypto'

/**
 * @param context {WebtaskContext}
 */
async function start(context: any, cb: Function) {
  const options = {
    highlightHost: 'https://www.mnufc.com',
    author: 'Mutmatt',
    repo: 'mutmatt.github.io',
    postHeader: `author: Matt Erickson (ME)
    layout: post
    tags:
      - mnufc
      - soccer
      - auto-post
    ---`,
    iframeTemplate: `<div class='soccer-video-wrapper'>
    <iframe class='soccer-video' width='100%' height='auto' frameborder='0' allowfullscreen src="https://www.mnufc.com/iframe-video?brightcove_id={replaceMe}&brightcove_player_id=default&brightcove_account_id=5534894110001"></iframe>
  </div>`,
  };
  const octokit = new Octokit();

  let highlightArray: any[] = []
  let videoPromises: any[] = []
  const cheerioHighlightBody = await rp({
    uri: `${options.highlightHost}/video-channels/match-highlights`,
    transform: function(body: any) {
      return cheerio.load(body)
    },
  })

  //crawl the page and get all the nodes for each highlight video
  _.map(cheerioHighlightBody('.views-row .node'), function(node: any) {
    let highlight = cheerioHighlightBody(node).find('.node-title a')

    //Remove unneeded parts of the title that make things look weird
    let title = highlight
      .text()
      .replace('HIGHLIGHTS: ', '')
      .replace(/\'/gi, '')
    let titleWithoutEndDate = title.replace(/\|.*/gi, '').replace('.', '')
    let titleWOEDAndSpaces = titleWithoutEndDate
      .replace(/\s/gi, '-')
      .replace(/\-$/, '')
    let postUrl = highlight.attr('href')
    var date = new Date(
      cheerioHighlightBody(node)
        .find('.timestamp')
        .text()
        .replace(/\s\(.*\)/gi, '')
    )
    let filename =
      date.getFullYear() +
      '-' +
      (date.getMonth() + 1) +
      '-' +
      date.getDate() +
      '-' +
      titleWOEDAndSpaces +
      '.md'
    let permalink = _.snakeCase(filename)

    highlightArray.push({
      filename: filename,
      title: title,
      postUrl: postUrl,
      date: date,
      permalink: permalink,
    })
  })

  //After we get all the nodes for the videos we need to fetch the post page for the video url itself
  _.forEach(highlightArray, function(highlight) {
    var vidProm = rp({
      uri: options.highlightHost + highlight.postUrl,
      transform: function(body) {
        return cheerio.load(body)
      },
    })
    videoPromises.push(vidProm)
  })

  //after all the videos come back lets add it to the highlight array and then send it to GH
  const videos = await Promises.all(videoPromises)
  console.log("checking the videos from the promises back from mnufc", videos.length)
  for (var i = 0; i < highlightArray.length; i++) {
    let videoHtml = options.iframeTemplate.replace(
      '{replaceMe}',
      videos[i]('video').attr('data-video-id')
    )
    let excerptText = videos[i]('.node .field-type-text-long p').text()
    highlightArray[i].video = videoHtml
    highlightArray[i].excerpt = excerptText
  }
  await SendNewFilesToGitHubRepo(highlightArray)

  async function SendNewFilesToGitHubRepo(allHighlights: any[]) {
    
    const previousMNUFCPosts = await rp({
      qs: {
        //@ts-ignore
        access_token: context.secrets.GITHUB_ACCESS_TOKEN,
      },
      headers: {
        'User-Agent': 'MN UFC auto blogger',
      },
      json: true,
      uri: `https://api.github.com/repos/Mutmatt/mutmatt.github.io/contents/_posts/mnufc/`,
    })

    console.log('send to github', allHighlights.length, previousMNUFCPosts.length);
    //We don't want to recreate old files so we will diff the two arrays
    let newPosts = _.differenceWith(allHighlights, previousMNUFCPosts, function(
      mnufcValue: any,
      githubObject: any
    ) {
      console.log('comparing the filenames ', mnufcValue.filename === githubObject.name);//mnufcValue.filename, githubObject.name);
      return false;
    })

    console.log("new posts coming in", newPosts.length);
    let ghPromises: any[] = []
    //Create the header for the markdown
    await _.forEach(newPosts, async function(post: any) {
      var postText = `---
  title: ${post.title}
  date: ${post.date}
  permalink: ${post.permalink}
  excerpt: ${post.excerpt}
  ${options.postHeader}
  ${post.video}`

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

      console.log('hey look github took my request', result)
      ghPromises.push(
        rp.put({
          qs: {
            access_token: context.secrets.GITHUB_ACCESS_TOKEN,
          },
          headers: {
            'User-Agent': 'MN UFC auto blogger',
          },
          json: true,
          method: 'PUT',
          uri: `https://api.github.com/repos/Mutmatt/mutmatt.github.io/contents/_posts/mnufc/${
            post.filename
          }`,
          body: {
            path: '_posts/mnufc',
            message: post.title,
            content: Buffer.from(postText).toString('base64'),
          },
        })
      )
    })

    //After all github files are created return the new posts
    //await Promises.all(ghPromises)

    cb(null, { newPosts })
  }
}

module.exports = start
