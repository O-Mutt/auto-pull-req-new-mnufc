import { Highlight } from './highlight';
import { Octokit } from '@octokit/core';
import { PullsCreateParams, GitGetRefParams } from '@octokit/plugin-rest-endpoint-methods/dist-types/generated/types';
import _ from 'lodash';

export async function SendNewFilesToGitHubRepo(
  options: any,
  context: any,
  allHighlights: Highlight[]
) {
  const octokit = new Octokit({
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
  let newPosts = _.differenceWith(
    allHighlights,
    previousUnitedPosts,
    function checkPreviousPostVsNew(mnufcValue: Highlight, githubObject: any) {
      return mnufcValue.filename === githubObject.name;
    }
  );

  const refParams: GitGetRefParams = {
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
      //don't really care about a failure as it is probably just `already exists`
    }

    await octokit.repos.createFile({
      owner: options.owner,
      repo: options.repo,
      path: `_posts/mnufc/${post.filename}`,
      message: post.title || 'Default MNUFC hightlight',
      content: Buffer.from(postText).toString('base64'),
      branch: newBranchName
    });

    const pullParams: PullsCreateParams = {
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