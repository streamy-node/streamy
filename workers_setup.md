# WORKERS SETUP

## With Docker
### Raspberry pi
docker run -dit -v /volume1/streamy/:/volume1/streamy -p 7000:7000 --restart unless-stopped --name streamy_worker --device=/dev/vchiq remote_ffmpeg_node:3.4.4-raspbian-stretch

### Ubuntu
docker run -dit -v /volume1/streamy/:/volume1/streamy:shared -p 7000:7000 --restart unless-stopped --name streamy_worker remote_ffmpeg_node:3.4.4-ubuntu-16.04
