# Streamy

## Installation (tested on ubuntu)

### Nodejs
Install latest version of node (right now it's 13)
```
curl -sL https://deb.nodesource.com/setup_13.x | sudo -E bash -
sudo apt install -y nodejs
```
Run `node -v` to check the installation

### MySQL / MariaDB
You need an instance of mysql or mariadb database. Here is an example with a docker.
```
export SQL_PWD="some_pwd"
export ROOT_SQL_PWD="some_other_pwd"
export DATABASE_LOCATION="some_path"
docker run --name streamy-db -d -e MYSQL_PASSWORD=$SQL_PWD -e MYSQL_DATABASE=streamy -e MYSQL_ROOT_PASSWORD=$ROOT_SQL_PWD -e MYSQL_USER=streamy -v $DATABASE_LOCATION:/var/lib/mysql -p 3306:3306 mariadb:10.0 --port 3306
```

### Streamy
Install streamy
```
git clone https://mickah@bitbucket.org/mickah/streamy.git
cd streamy
npm install
# Update config.yaml file with your db passwords and client config
node bin/www
```

If you connect to `http://127.0.0.1:8080/` you should see the login page!!!

### Setup streamy

On the first run, a default user is added: `admin` with the password `astreamy` (you should change it in users menu on the top right)

#### Setup your storage location(s)
By default streamy does not know where to put the videos you will add. You need to add one or several storage locations. These are called bricks. In the top right menu, click on storage.
Give an alias an a brick path. If you want to transcode using different machines you need this location to be a shared folder otherwise you can put any folder you want.

Click on add.

#### Setup global settings
Now that you have created one or several bricks, you need to tell how to use these bricks. Here are the setting availables

**upload_brick** correspond to the brick where raw uploaded files should be put (before transcoding). The file here are removed once the transcoding is done.

**new_video_brick** correspond to the brick where transcoded files should be put. You can select the same brick for **upload_brick** and **new_video_brick** as a subfolder is created

**Offline H264 Profile** (will be deprecated) Tell which H264 profile to use for transcoding. You can let the default value.

**Offline H264 preset** (will be deprecated) Tell which H264 preset to use for transcoding. The slower it is the better is the quality

**tmdb_api_key** The themoviedb api key to retreive media informations (pictures, overviews, ...). You need to request an api key on https://developers.themoviedb.org/3/getting-started/introduction. We currently use the v3.

Click on save!

You can now add series, films in streamy. However as you don't have any transcoder yet you won't be able to visualize them :'( . You need to add a transcoder for that. A transcoder take your uploaded video files and convert them to be available on most platforms with adaptative streaming.

### Add transcoding workers
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
- Add a description of streamy in README
- Add CI
- Add dockerfile for streamy
- Keep track of the user progression, seen/not seen
- Propose next episodes
- Do live transcoding
- Create a streamy proxy to share content from another streamy server
- Allow transcoding via ssh only (no shared drives)
- ...

## Known issues
- restart needed after changing the upload brick (it's ok if there were no upload brick before)
