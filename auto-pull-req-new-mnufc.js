var YQL = require('yql');
module.exports = function(cb) {
  
    var query = new YQL("select * from fantasysports.games where game_key='238'");
    
    var data;
    require('request').query.exec(function(err, theDat) {
      data = theDat;
      console.log(theDat);
    });
  cb(null, { msg: data});
};
