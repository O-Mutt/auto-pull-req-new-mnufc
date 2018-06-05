var YQL = require('yql');
module.exports = function(cb) {
  
    var query = new YQL("select * from fantasysports.games where game_key='238'");
    
    query.exec(function(err, data) {
      console.log(data);
    });
  cb(null, { msg: data});
};
