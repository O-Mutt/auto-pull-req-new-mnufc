var YQL = require('yql');
module.exports = function(cb) {
  
    var query = new YQL("SELECT * FROM weather.forecast WHERE (location = 94089)");
    
    var data;
    query.exec(function(err, theDat) {
      data = theDat;
      console.log(theDat);
    });
  cb(null, { msg: data});
};
