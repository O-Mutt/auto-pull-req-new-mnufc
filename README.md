# auto-pull-req-new-mnufc

## Why
* :heart: - MNUFC
* Automated updates to my blog (in the MNUFC update)
* Scraping content without manual intervention

## How
* Using basic node web scraping techniques to grab the content from the mnufc page
* Get the repo/subfolder for the MNUFC posts from mutmatt.github.io
* Diff what exists with what is new
* Create new html posts using the highlight videos
* Using the github api create new files and create a PR to the mutmatt.github.io repo

## Dev
This is a node/typescript based project. 
* `Git Clone`
* `npm install`
* `touch .env`
* `echo "GITHUB_ACCESS_TOKEN=[Your Personal Access Token]" > .env`
  * [Can be created/found here](https://github.com/settings/tokens)
* `npm run start`
  * That will run `ts-node index` (this could be run manually if you _really_ want to).

This will run the entirety of the #How section and create any PRs to the mutmatt.github.io repo. 

## Testing
Ha

## How this functions
This app is run via GitHub Actions. 
There are two trigger methods
1) pushing to this repo
1) cron at 03:00 and 15:00 UTC
