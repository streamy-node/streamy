# FFMPEG

Use ffmpeg to create mp4 files
Use mp4boxes to create manifests

ffmpeg -re -i <input> -map 0 -map 0 -c:a libfdk_aac -c:v libx264 \
-b:v:0 800k -b:v:1 300k -s:v:1 320x170 -profile:v:1 baseline \
-profile:v:0 main -bf 1 -keyint_min 120 -g 120 -sc_threshold 0 \
-b_strategy 0 -ar:a:1 22050 -use_timeline 1 -use_template 1 \
-window_size 5 -adaptation_sets "id=0,streams=v id=1,streams=a" \
-single_file 1 -single_file_name outputdashed.mpd  \
-f dash ./out.mpd


/opt/ffmpeg/bin/ffmpeg -re -i output.mp4 -map 0 -map 0 -c:a libfdk_aac -c:v libx264 \
-b:v:0 800k -b:v:1 300k -s:v:1 320x170 -profile:v:1 baseline \
-profile:v:0 main -bf 1 -keyint_min 120 -g 120 -sc_threshold 0 \
-b_strategy 0 -ar:a:1 22050 -use_timeline 1 -use_template 1 \
-window_size 5 \
-single_file 1 -single_file_name outputdashed.mpd  \
-f dash ./out.mpd

/opt/ffmpeg/bin/ffmpeg -re -i output.mp4 -map 0 -map 0 -c:a copy -c:v copy \
-b_strategy 0 -ar:a:1 22050 -use_timeline 1 -use_template 1 \
-window_size 5 \
-single_file 1 -single_file_name outputdashed_copy.mp4  \
-f dash ./out_copy.mpd

/opt/ffmpeg/bin/ffmpeg -re -i output.mp4 -map 0 -map 0 -c:a libfdk_aac -c:v libx264 \
-b:v:0 800k \
-profile:v:0 main -bf 1 -keyint_min 120 -g 120 -sc_threshold 0 \
-b_strategy 0 -use_timeline 1 -use_template 1 \
-f dash ./out_copy3.mpd

//
ffmpeg -i video.mp4 -an -c:v libx264 -x264opts 'keyint=24:min-keyint=24:no-scenecut' -b:v 5300k -maxrate 5300k -bufsize 2650k -vf 'scale=-1:1080' video-1080.mp4
MP4Box -dash 1000 -rap -frag-rap -profile onDemand -out video.mpd video-1080.mp4 video-720.mp4 video-480.mp4 video-360.mp4 video-240.mp4 video-audio.mp4
//Working
ffmpeg -i ../output.mp4 -an -strict -2 -f dash output.mpd 

ffmpeg -i ../output.mp4 -an -strict -2 -b_strategy 0 -use_timeline 1 -use_template 1 -single_file 1  -single_file_name outputdashed_copy.mp4 -f dash output.mpd 


## MP4 splitting (10+10+30sec)
ffmpeg -i '../output.mp4' -an -sn -c:v copy video.mp4

ffmpeg -i '/media/michael/Data1/tmp/videos/Money Monster (2016)/Money Monster 2016 1080p BluRay x264 DTS-JYK.mkv' -c:a copy -sn -vn audio-en.mp4

MP4Box -dash 1000 -rap -frag-rap -profile onDemand -out video.mpd video.mp4 audio-en.mp4

### Audio transcode 1 min
ffmpeg -i 'Money Monster 2016 1080p BluRay x264 DTS-JYK.mkv' -c:a aac -ac 2 -ab 128k -vn audio-aac.mp4

## MP4 joining 15 sec
ffmpeg -i video.mp4 -i audio-aac.mp4 \
-c:v copy -c:a copy joined.mp4

##GPU
/opt/ffmpeg/bin/ffmpeg -i 'Money Monster 2016 1080p BluRay x264 DTS-JYK.mkv' -an -c:v h264_nvenc -no-scenecut -pix_fmt yuv420p -b:v 2400k -maxrate 2400k -bufsize 1200k video_x264.mp4

### Convert mapping
https://bitmovin.com/video-bitrate-streaming-hls-dash/
res				fps	br		bit/pix
426×240		24	400		0.17
640×360		24	800		0.15
854×480		24	1200	0.12
1280×720	24	2400	0.11
1920×1080	24	4800	0.10
4096×2160	24	16000	0.08

## Convert command
https://rybakov.com/blog/mpeg-dash/
1920×1080 24
ffmpeg -y -i "../output.mp4" -c:a aac -b:a 192k  -vn "output_audio.m4a"
ffmpeg -i "../output.mp4" -c:a aac -ac 6 -strict -2 -b:a 192k -vn "output_audio.m4a"

ffmpeg -y -i "../output.mp4" -preset slow -tune film -vsync passthrough -write_tmcd 0 -an -c:v libx264 -x264opts 'keyint=25:min-keyint=25:no-scenecut' -crf 22 -maxrate 4800k -bufsize 9600k -pix_fmt yuv420p -f mp4 "output_4800.mp4"
/opt/ffmpeg/bin/ffmpeg -y -i "../output.mp4" -preset slow -tune film -vsync passthrough -write_tmcd 0 -an -c:v libx264 -x264opts 'keyint=25:min-keyint=25:no-scenecut' -crf 23 -maxrate 2400k -bufsize 4800k -pix_fmt yuv420p -f mp4  "output_2400.mp4"
# static file for ios and old browsers --> generated
#ffmpeg -y -i "output_audio.m4a" -i "output_4800.mp4" -codec copy output_static.mp4

MP4Box -dash 2000 -rap -frag-rap  -bs-switching no -profile "dashavc264:live" "output_4800.mp4" "output_audio.m4a" -out "output.mpd"
# create a jpg for poster. Use imagemagick or just save the frame directly from ffmpeg is you don't have mozcjpeg installed.
    ffmpeg -i "${fe}" -ss 00:00:00 -vframes 1  -qscale:v 10 -n -f image2 - | mozcjpeg -progressive -quality 2,35 -quant-table 2 -outfile "${f}"/"${f}".jpg


#ffmpeg only single file
# only video convert
/opt/ffmpeg/bin/ffmpeg -re -i ../output.mp4 -an -sn -c:v libx264 \
-b:v:0 4800k -profile main -bf 1 -keyint_min 120 -g 120 -sc_threshold 0 \
-b_strategy 0 -use_timeline 1 -use_template 1 -single_file 1 -single_file_name video1.mp4 \
-f dash ./video1.mpd
# only video cpy
/opt/ffmpeg/bin/ffmpeg -re -i video1.mp4 -an -sn -c:v copy \
-use_timeline 1 -use_template 1 -single_file 1 -single_file_name video1-cpy.mp4 \
-f dash ./video1.mpd
# only audio
/opt/ffmpeg/bin/ffmpeg -re -i ../output.mp4 -vn -sn -c:a libfdk_aac \
-ac 2 -ab 128k -vn \
-use_timeline 1 -use_template 1 -single_file 1 -single_file_name audio1.mp4 \
-f dash ./audio1.mpd

/opt/ffmpeg/bin/ffmpeg -i ../output.mp4 -vn -sn -c:a libfdk_aac \
-ac 2 -ab 128k -vn \
-use_timeline 1 -use_template 1 -single_file 1 -single_file_name audio1.mp4 \
-f dash ./audio1.mpd

#ffmpeg templates
ffmpeg -i b6fd76b86b20322b0c6a1f5e869a1fac4b34987e896e2ecb26c53d6aabd54e9b.mp4 -y -an -sn -c:v libx264 -b:v:0 500K -profile main -preset veryfast -keyint_min 48 -g 48 -b_strategy 0 -sc_threshold 0 -use_timeline 1 -min_seg_duration 4000 -use_template 1 -f dash video_only/video.mpd

ffmpeg -i b6fd76b86b20322b0c6a1f5e869a1fac4b34987e896e2ecb26c53d6aabd54e9b.mp4 -y -vn -sn -c:a:0 libfdk_aac -ac 2 -ab 384K -use_timeline 1 -min_seg_duration 4000 -use_template 1 -f dash audio_only/audio.mpd

both
ffmpeg -i b6fd76b86b20322b0c6a1f5e869a1fac4b34987e896e2ecb26c53d6aabd54e9b.mp4 -y -sn -c:v libx264 -b:v:0 500K -profile main -preset veryfast -keyint_min 48 -g 48 -b_strategy 0 -sc_threshold 0 -c:a:0 libfdk_aac -ac 2 -ab 384K  -use_timeline 1 -min_seg_duration 4000 -use_template 1 -f dash video_audio/video_audio.mpd

or
ffmpeg -i b6fd76b86b20322b0c6a1f5e869a1fac4b34987e896e2ecb26c53d6aabd54e9b.mp4 -y -sn -c:v libx264 -b:v:0 500K -profile main -preset veryfast -keyint_min 48 -g 48 -b_strategy 0 -sc_threshold 0 -c:a:0 libfdk_aac -ac 2 -ab 384K  -use_timeline 0 -min_seg_duration 4000 -use_template 1 -f dash video_audio_notime/video_audio.mpd

multi resolution
ffmpeg -i b6fd76b86b20322b0c6a1f5e869a1fac4b34987e896e2ecb26c53d6aabd54e9b.mp4 -map 0:0 -map 0:0 -map 0:1 -y -sn -c:v:0 libx264 -b:v:0 500K -profile:v:0 main -preset:v:0 veryfast -keyint_min:v:0 48 -g 48 -b_strategy:v:0 0 -sc_threshold:v:0 0 -c:v:1 libx264 -b:v:1 300K -filter:v:1 scale=480:-2 -profile:v:1 main -preset:v:1 veryfast -keyint_min 48 -g 48 -b_strategy 0 -sc_threshold 0 -c:a:0 libfdk_aac -ac 2 -ab 384K  -use_timeline 0 -min_seg_duration 4000 -use_template 1 -f dash video_audio_scale/video_audio.mpd
# libx264 options
https://sites.google.com/site/linuxencoding/x264-ffmpeg-mapping


  export PATH=/opt/ffmpeg/bin:$PATH
test
ffmpeg -i b6fd76b86b20322b0c6a1f5e869a1fac4b34987e896e2ecb26c53d6aabd54e9b.mp4 -map 0:0 -map 0:0 -map 0:1 -map 0:2 -y -c:v:0 libx264 -b:v:0 500K -profile:v:0 main -preset:v:0 veryfast -keyint_min:v:0 48 -g 48 -b_strategy:v:0 0 -sc_threshold:v:0 0 -c:v:1 libx264 -b:v:1 300K -filter:v:1 scale=480:-2 -profile:v:1 main -preset:v:1 veryfast -keyint_min 48 -g 48 -b_strategy 0 -sc_threshold 0 -c:a:0 libfdk_aac -ac 2 -ab 384K -c:s:0 webvtt webvtt -f webvtt second.vtt -use_timeline 0 -min_seg_duration 4000 -use_template 1  -f dash video_audio_sub/all.mpd

extract sub
ffmpeg -i b6fd76b86b20322b0c6a1f5e869a1fac4b34987e896e2ecb26c53d6aabd54e9b.mp4 -map 0:2 -map 0:0 -c:s:0 webvtt -flush_packets 1 -f webvtt first.vtt -map 0:0 -map 0:1 -y -c:v:0 libx264 -b:v:0 500K -profile:v:0 main -preset:v:0 veryfast -keyint_min:v:0 48 -g 48 -b_strategy:v:0 0 -sc_threshold:v:0 0 -c:v:1 libx264 -b:v:1 300K -filter:v:1 scale=480:-2 -profile:v:1 main -preset:v:1 veryfast -keyint_min 48 -g 48 -b_strategy 0 -sc_threshold 0 -c:a:0 libfdk_aac -ac 2 -ab 384K -use_timeline 0 -min_seg_duration 4000 -use_template 1  -f dash video_audio_sub/all.mpd

 ffmpeg -i '/media/michael/Data2/tmp/upload/adev/Westworld.S02E01.720p.WEB.H264-DEFLATE.mkv' -y -c:s:0 webvtt -flush_packets 1 -f webvtt first.vtt


