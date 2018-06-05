var Bluebird = require('bluebird');
var Request = Bluebird.promisifyAll(require('request'));
var _       = require('lodash');

var API_URL = 'https://api.github.com';
var WEB_URL = 'https://github.com';
var REF = 'refs/heads/master';

/**
* @param context {WebtaskContext}
*/
module.exports = function (context, cb) {
  var msg;
  var err;

  if (!context.body) {
    err = new Error('This webtask must be created with the `--parse` flag (`pb` claim)');
    return cb(err);
  }

  if (!Array.isArray(context.body.commits)) {
    err = new Error('Unexpected payload: Missing commits array.');
    return cb(err);
  }

  if (!context.body.repository) {
    err = new Error('Unexpected payload: Missing repository information.');
    return cb(err);
  }
  var payload = context.body;
  var affectsPackageJson = _.find(payload.commits, function (commit) {
    return commit.modified.indexOf('package.json') >= 0
        || commit.added.indexOf('package.json') >= 0;
  });

  if (payload.ref !== REF) {
    msg = 'Push event does not affect the ref `' + REF + '`.';
    return cb(null, msg);
  }

  if (!affectsPackageJson) {
    msg = 'Commits `' + _(payload.commits).pluck('id').join('`, `')
        + '` do not affect the file `package.json`.';
    return cb(null, msg);
  }

  var headers = {
    'Authorization': 'Bearer ' + context.secrets.GITHUB_TOKEN,
    'User-Agent': 'Webtask Tagger',
  };

  var versionBeforePromise = getVersionFromCommit(payload.before);
  var versionAfterPromise = getVersionFromCommit(payload.after);

  Bluebird.join(versionBeforePromise, versionAfterPromise, function (versionBefore, versionAfter) {
    return versionBefore !== versionAfter
        ? createNewTag(payload.after, versionAfter)
       : 'This push did not update the package\'s version';
  })
  .nodeify(cb);


  // Helper functions

  function getVersionFromCommit(commitSha) {
    // If we're dealing with the initial commit, the `before`
    // commit sha will be zeroed out. Shortcut and return 0.0.0.
    if (commitSha === '0000000000000000000000000000000000000000') {
      return Bluebird.resolve('0.0.0');
    }

    var url = WEB_URL + '/' + payload.repository.full_name + '/raw/' + commitSha + '/package.json';
    var promise = Request.getAsync(url);

    return promise
      // Because request callbacks have the (err, res, body) signature,
      // Bluebird will resolve to a 2-element array like [res, body].
      // We only want the body, at index 1 in the array.
      .get(1)
      // The body should be a plain String, we want to parse
      // it into a javascript object.
      .then(JSON.parse)
      // Now that our Promise contains the parsed package.json, let's
      // pull out the `version`.
      .get('version');
  }

  function createNewTag(commitSha, version) {
    var now = new Date();
    var url = API_URL + '/repos/' + payload.repository.full_name + '/git/tags';
    var options = {
      url: url,
      headers: headers,
      json: true,
      body: {
          tag: 'v' + version,
          message: 'v' + version,
          object: commitSha,
          type: 'commit',
          tagger: {
              name: payload.pusher.name,
              email: payload.pusher.email,
              date: now.toISOString(),
          },
      }
    };
    var promise = Request.postAsync(options);

    return promise
      .get(1)
      .then(function (tag) {
          return createTagRef(tag.sha, tag.tag);
      });
  }

  function createTagRef(commitSha, tagName) {
    var url = API_URL + '/repos/' + payload.repository.full_name + '/git/refs';
    var options = {
      url: url,
      headers: headers,
      json: true,
      body: {
          ref: 'refs/tags/' + tagName,
          sha: commitSha,
      },
    };
    var promise = Request.postAsync(options);

    return promise
      .get(1)
      .then(function (tagRef) {
          return 'Successfully created tag `' + tagName + '`.';
      });
  }
};
