import { Highlight } from './highlight';
import { Octokit } from '@octokit/rest';
import _ from 'lodash';
import { Logger } from "tslog";
import { ReposGetContentResponseData, RequestParameters } from '@octokit/types';

const log: Logger = new Logger({ name: "SendFilesToGitHub" });

export async function SendNewFilesToGitHubRepo(
  options: any,
  highlightsFromWebsite: Highlight[]
) {
  const octokit = new Octokit({
    auth: `${process.env.GITHUB_ACCESS_TOKEN}`
  });
  
  let existingRepoPosts: ReposGetContentResponseData[] = [];
  try {
    const postsRequest = await octokit.repos.getContent({
      owner: options.owner,
      repo: options.repo,
      path: `_posts/mnufc`,
      ref: `heads/master`
    });
    existingRepoPosts = postsRequest.data as unknown as ReposGetContentResponseData[];
    log.info(`The number of posts we already have ${existingRepoPosts}`);
  } catch (e) {
    log.error(`Error in getting content from mnufc repo`, e);
    //error occured because we can't get the old posts
  }

  //We don't want to recreate old files so we will diff the two arrays
  let newPosts = _.differenceWith<Highlight, ReposGetContentResponseData>(
    highlightsFromWebsite,
    existingRepoPosts,
    function checkPreviousPostVsNew(mnufcValue: Highlight, githubObject: ReposGetContentResponseData) {
      log.debug(`match the existing files for a diff from the old ${mnufcValue.filename} to the new ${githubObject.name}. Do they match ${mnufcValue.filename === githubObject.name}`);
      return mnufcValue.filename === githubObject.name;
    }
  );
  log.info(`New posts length ${newPosts.length}`);


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
      log.prettyError(e);
    }

    const createNewFileContents = await octokit.repos.createOrUpdateFileContents({
      owner: options.owner,
      repo: options.repo,
      path: `_posts/mnufc/${post.filename}`,
      message: post.title || 'Default MNUFC hightlight',
      content: Buffer.from(postText).toString('base64'),
      branch: newBranchName
    });
    log.info("Creating a new file contents", createNewFileContents.data.commit.sha);

    const pullParams = {
      owner: options.owner,
      repo: options.repo,
      title: post.title || `Default MNUFC Highlight`,
      base: `master`,
      body: `${post.excerpt}`,
      head: newBranchName
    };
    const result = await octokit.pulls.create(pullParams);
    log.info("Creating the new PR", result.url);
  }

  return newPosts;
}