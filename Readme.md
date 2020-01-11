# Streamy

## Description

Streamy is a collaborative multimedia web server. It has been made to share videos (movies/series and soon custom videos) between you and your family/friends. Any registred user with enough permission can upload video content so that everyone can watch it.

Advantages:
  - no app to install, it's only a web page
  - chrome cast support
  - offline mode
  - adaptative streaming (only dash for now)
  - handle multi lang and audio that can be switched dynamically
  - Multi transcoders support (called workers)

Current limitations:
  - No Iphone support yet (dash streaming not supported)
  - No live transcoding yet => **you need to wait that the file is transcoded before watching it**(only offline)
  - Only CPU transcoding is used for now (for better and consistent quality)
  - ... see TODO at the end of this file ^^

Disclamer 1: This project is not yet ready for a first release. It's functionnal but a lot of changes are expected. It mainly target developers.

Other streaming project that you may prefer (I am not part of them):
- (streama)[https://github.com/streamaserver/streama]: cool popular project more advanced than this one. Nice GUI, quite big community. However It uses a lot of RAM (more than 1Go) and they don't do transcoding for now (but they talk about it)


## Installation with docker-compose (Recommended)
If you have docker-compose installed on your computer, you can start streamy and it's database with one command. You just need to set several environment variables

- MYSQL_ROOT_PASSWORD: root password of the database that will be created
- STREAMY_DB_DATABASE: name of the database to create
- STREAMY_DB_USER: name of the db user that streamy will use
- STREAMY_DB_PASSWORD: passord of the db
- MYSQL_PERSISTENT_FOLDER: folder on your computer where the sql database will be stored
- STREAMY_BRICK_FOLDER: folder on your computer that will be used for storing videos
- STREAMY_UID user uid to use for streamy container (create files ...)
- STREAMY_GID user gid to use for streamy container
```
MYSQL_ROOT_PASSWORD=pwd2 STREAMY_DB_DATABASE=streamy STREAMY_DB_USER=streamy STREAMY_DB_PASSWORD=pwd1 MYSQL_PERSISTENT_FOLDER=/data/streamy/mysql STREAMY_BRICK_FOLDER=/data/streamy/brick1 STREAMY_UID=$(id -u) STREAMY_GID=$(id -g) docker-compose up
```

**Important note**: 
- A Nginx reverse proxy with certificates should be added in front of streamy to add https. Do not put streamy directly on internet without https! It will be added later in the compose file.
- ChromeCast works only if your server use https => you need an nginx + certificate

## Setup streamy
On the first run, a default user is added: `admin` with the password `astreamy` (you should change it in users menu on the top right)

### Setup your storage location(s)
By default streamy does not know where to put the videos you will add. You need to add one or several storage locations. These are called bricks. In the top right menu, click on storage.
Give an alias an a brick path. If you want to transcode using different machines you need this location to be a shared folder otherwise you can put any folder you want.

Click on add.

### Setup global settings
Now that you have created one or several bricks, you need to tell how to use these bricks. Here are the setting availables

**upload_brick** correspond to the brick where raw uploaded files should be put (before transcoding). The file here are removed once the transcoding is done.

**new_video_brick** correspond to the brick where transcoded files should be put. You can select the same brick for **upload_brick** and **new_video_brick** as a subfolder is created

**Offline H264 Profile** (will be deprecated) Tell which H264 profile to use for transcoding. You can let the default value.

**Offline H264 preset** (will be deprecated) Tell which H264 preset to use for transcoding. The slower it is the better is the quality

**tmdb_api_key** The themoviedb api key to retreive media informations (pictures, overviews, ...). You need to request an api key on https://developers.themoviedb.org/3/getting-started/introduction. We currently use the v3.

Click on save!

You can now add series, films in streamy. However as you don't have any transcoder yet you won't be able to visualize them :'( . You need to add a transcoder for that. A transcoder take your uploaded video files and convert them to be available on most platforms with adaptative streaming.

## Add transcoding workers
To add a worker we use another project called remote-ffmpeg-node. You need to build 2 dockers. One containing a compiled version of ffmpeg **streamy_ffmpeg** and another one based on this one which add remote control capabilities **remote_ffmpeg_node**
```
git clone https://github.com/mickah/remote-ffmpeg-node
cd remote-ffmpeg-node/docker/ubuntu/streamy_ffmpeg
docker build -t streamy_ffmpeg:3.4.4-ubuntu-16.04 .
cd ..
docker build -t remote_ffmpeg_node:3.4.4-ubuntu-16.04 .
```

Once this is done you can start the docker. The transcoding port is 7000. For the moment, you need to mount all the bricks on the docker with the same path as the streamy server sees it.
```
docker run -d -p 7000:7000 -v /brick1_path:/brick1_path -v /brick2/some_path:/brick2/some_path remote_ffmpeg_node:3.4.4-ubuntu-16.04
```

Now you just need to add it in streamy via the workers menu on the top right corner.

You streamy is now completly ready!

## TODO
- Keep track of the user progression, seen/not seen
- Propose next episodes
- Do live transcoding
- Create a streamy proxy to share content from another streamy server
- Allow transcoding via ssh only (no shared drives)
- Add tests (transcoding)
- Refacto transcoding
- Easy setup
- Add personnal video (not only movies and series)
- Add Demo page
- Handle multilang for the website/overview
- Add explanation about reverse proxy
- Add Synology ARM based installation instructions
- Streamy proxy so that you can share content from another streamy server
- Improve HMI
- ...

## Known issues
- restart needed after changing the upload brick (it's ok if there were no upload brick before)
