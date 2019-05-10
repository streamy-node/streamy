const Moviedb = new require('moviedb-promise');

class MovieDBMgr{
  constructor(settingsMgr){
    this.moviedb = null;
    this.settings = settingsMgr;
    this.api_key = settingsMgr.global.tmdb_api_key;

    if(this.api_key.length == 0){
      console.warn("The Movie Database API Key not yet setted")
    }else{
      this.setApiKey(this.api_key)
    }
    var self = this;
    this.settings.on('setting_change',function(newSettings){
      if(this.api_key !== newSettings.tmdb_api_key){
        self.setApiKey(newSettings.tmdb_api_key);
      }
    })
  }

  setApiKey(tmdb_api_key){
    if(tmdb_api_key.length == 0){
      console.error("Invalid TheMovieDB api key, it should not be empty!")
      return false;
    }
    this.api_key = tmdb_api_key;
    this.moviedb = new Moviedb(tmdb_api_key)
    return true;
  }

  async tvInfo(val){
    if(!this.moviedb){
      throw new Error("The Movie DB API key not setted !")
    }
    return await this.moviedb.tvInfo(val);
  }

  async tvSeasonInfo(val){
    if(!this.moviedb){
      throw new Error("The Movie DB API key not setted !")
    }
    return await this.moviedb.tvSeasonInfo(val);
  }
  
  async movieInfo(val){
    if(!this.moviedb){
      throw new Error("The Movie DB API key not setted !")
    }
    return await this.moviedb.movieInfo(val);
  }

  async genreMovieList(val){
    if(!this.moviedb){
      throw new Error("The Movie DB API key not setted !")
    }
    return await this.moviedb.genreMovieList(val);
  }

  async genreTvList(val){
    if(!this.moviedb){
      throw new Error("The Movie DB API key not setted !")
    }
    return await this.moviedb.genreTvList(val);
  }  
}

//var moviedb = new MovieDBMgr()

module.exports=MovieDBMgr;