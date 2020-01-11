-- CREATE DATABASE `streamy`;
-- USE `streamy`;

CREATE TABLE `languages` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` char(49) CHARACTER SET utf8 DEFAULT NULL,
  `iso_639_1` char(2) CHARACTER SET utf8 DEFAULT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT UNIQUE (`iso_639_1`)
) DEFAULT CHARSET=utf8 COLLATE=utf8_bin AUTO_INCREMENT=136 ;

-- ffmpeg use 639_2
CREATE TABLE `languages_iso_639_2` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `language_id` int(10) unsigned NOT NULL,
  `iso_639_2` char(3) CHARACTER SET utf8 DEFAULT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT UNIQUE (`iso_639_2`),
  FOREIGN KEY (`language_id`) REFERENCES languages(`id`) ON DELETE CASCADE
) DEFAULT CHARSET=utf8 COLLATE=utf8_bin AUTO_INCREMENT=136 ;

-- IETF language
CREATE TABLE `languages_subtags` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `language_id` int(10) unsigned NOT NULL,
  `subtag` char(4) CHARACTER SET utf8 DEFAULT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT UNIQUE (`language_id`,`subtag` )
) DEFAULT CHARSET=utf8 COLLATE=utf8_bin AUTO_INCREMENT=136 ;

CREATE TABLE `genres` (
  `id` int NOT NULL,
  `default_name` char(49) CHARACTER SET utf8 NOT NULL,
  PRIMARY KEY (`id`)
);

CREATE TABLE `bricks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `brick_alias` char(49) CHARACTER SET utf8 NOT NULL,
  `brick_path` VARCHAR(255)  CHARACTER SET utf8 NOT NULL,
  `enabled` TINYINT(2) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  CONSTRAINT UNIQUE(`brick_alias`),
  CONSTRAINT UNIQUE(`brick_path`)
) AUTO_INCREMENT=1;

CREATE TABLE `resolutions` (
  `id` int NOT NULL,
  `name` varchar(50)  CHARACTER SET utf8 NOT NULL,
  `width` int NOT NULL,
  `height` int NOT NULL,
   PRIMARY KEY (`id`),
   CONSTRAINT UNIQUE (`name`),
   CONSTRAINT UNIQUE (`width`) 
);

-- Users
CREATE TABLE `permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) CHARACTER SET utf8 NOT NULL,
  PRIMARY KEY (`id`)
);

CREATE TABLE `roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) CHARACTER SET utf8 NOT NULL,
  PRIMARY KEY (`id`)
);

CREATE TABLE `roles_permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `role_id` int NOT NULL,
  `permission_id` int NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`role_id`) REFERENCES roles(`id`),
  FOREIGN KEY (`permission_id`) REFERENCES permissions(`id`)
);

CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(255) CHARACTER SET utf8 NOT NULL,
  `password` VARCHAR(255)  CHARACTER SET utf8 NOT NULL,
  `role_id` int NOT NULL,
  `qos_priority` TINYINT UNSIGNED NOT NULL,
  `last_connection` datetime,
  `email` VARCHAR(255),
  `phone` VARCHAR(255),
  `added_date` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`role_id`) REFERENCES roles(`id`),
  CONSTRAINT UNIQUE (`username`) 
);

CREATE TABLE `users_extra_permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `permission_id` int NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`user_id`) REFERENCES users(`id`),
  FOREIGN KEY (`permission_id`) REFERENCES permissions(`id`)
);

CREATE TABLE `resolutions_bitrates` (
  `id` int NOT NULL,
  `resolution_id` int NOT NULL,
  `bitrate` int NOT NULL,
   PRIMARY KEY (`id`),
   CONSTRAINT UNIQUE (`resolution_id`),
   FOREIGN KEY (`resolution_id`) REFERENCES resolutions(`id`) ON DELETE CASCADE
);

CREATE TABLE `audio_bitrates` (
  `id` int NOT NULL,
  `name` varchar(50) NOT NULL,
  `channels` int NOT NULL,
  `bitrate` int NOT NULL,
   PRIMARY KEY (`id`),
   CONSTRAINT UNIQUE (`name`),
   CONSTRAINT UNIQUE (`channels`)
);

CREATE TABLE `genres_moviedb` (
  `id` int NOT NULL,
  `genre_id` int NOT NULL,
  `moviedb_id` int NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`genre_id`) REFERENCES genres(`id`) ON DELETE CASCADE,
  CONSTRAINT UNIQUE (`genre_id`,`moviedb_id`)
);

CREATE TABLE `genres_translations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `genre_id` int NOT NULL,
  `lang_id` int(10) unsigned NOT NULL,
  `name` char(49) CHARACTER SET utf8 NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`genre_id`) REFERENCES genres(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`lang_id`) REFERENCES languages(`id`) ON DELETE CASCADE 
);

CREATE TABLE `categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `category` VARCHAR(255),
  PRIMARY KEY (`id`),
  CONSTRAINT UNIQUE (`category`)
);

CREATE TABLE `media` (
  `id` int NOT NULL AUTO_INCREMENT,
  `release_date` datetime,
  `rating` decimal(3,1) DEFAULT '0.0',
  `rating_count` int UNSIGNED DEFAULT '0',
  `original_name` VARCHAR(255) CHARACTER SET utf8,
  `original_language` char(2) CHARACTER SET utf8,
  `easy_name` VARCHAR(255)  CHARACTER SET utf8,
  `brick_id` int,
  `added_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `has_mpd` TINYINT(2) NOT NULL,
  `use_mpd` TINYINT(2) NOT NULL,
  `path` VARCHAR(255) CHARACTER SET utf8,
  `category_id` int ,
  `parent_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`original_language`) REFERENCES languages(`iso_639_1`),
  FOREIGN KEY (`brick_id`) REFERENCES bricks(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`category_id`) REFERENCES categories(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`parent_id`) REFERENCES media(`id`) ON DELETE CASCADE,
  CONSTRAINT UNIQUE (`original_name`,`release_date`,`category_id`,`brick_id`)
);

CREATE TABLE `media_translations` (
    `id` int NOT NULL AUTO_INCREMENT,
    `media_id` int NOT NULL,
    `lang_id` int(10) unsigned NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `overview` VARCHAR(765),
    PRIMARY KEY (`id`),
    FOREIGN KEY (`media_id`) REFERENCES media(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`lang_id`) REFERENCES languages(`id`)
);

CREATE TABLE `mpd_files` (
  `id` int NOT NULL AUTO_INCREMENT,
  `media_id` int NOT NULL,
  `folder` VARCHAR(255)  CHARACTER SET utf8 NOT NULL,
  `complete` TINYINT(2) NOT NULL,
  `user_id` int,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`media_id`) REFERENCES media(`id`) ON DELETE CASCADE 
);

CREATE TABLE `mpd_videos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `mpd_id` int NOT NULL,
  `resolution_id` int NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`mpd_id`) REFERENCES mpd_files(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`resolution_id`) REFERENCES resolutions(`id`)
);

CREATE TABLE `mpd_audios` (
  `id` int NOT NULL AUTO_INCREMENT,
  `mpd_id` int NOT NULL,
  `lang_id` int(10) unsigned,
  `lang_subtag_id` int(10) unsigned,
  `channels` int,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`mpd_id`) REFERENCES mpd_files(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`lang_id`) REFERENCES languages(`id`)
);

CREATE TABLE `mpd_srts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `mpd_id` int NOT NULL,
  `lang_id` int(10) unsigned,
  `lang_subtag_id` int(10) unsigned,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`mpd_id`) REFERENCES mpd_files(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`lang_id`) REFERENCES languages(`id`)
);

CREATE TABLE `media_movies` (
  `id` int NOT NULL AUTO_INCREMENT,
  `media_id` int NOT NULL ,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`media_id`) REFERENCES media(`id`) ON DELETE CASCADE
);

CREATE TABLE `media_series` (
  `id` int NOT NULL AUTO_INCREMENT,
  `media_id` int NOT NULL ,
  `number_of_seasons` TINYINT UNSIGNED,
  `number_of_episodes` INT UNSIGNED,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`media_id`) REFERENCES media(`id`) ON DELETE CASCADE
);

CREATE TABLE `media_seasons` (
  `id` int NOT NULL AUTO_INCREMENT,
  `media_id` int NOT NULL ,
  `season_number` int NOT NULL,
  `number_of_episodes` int NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`media_id`) REFERENCES media(`id`) ON DELETE CASCADE,
  CONSTRAINT UNIQUE (`media_id`,`season_number`) 
);

CREATE TABLE `media_episodes` (
    `id` int NOT NULL AUTO_INCREMENT,
    `media_id` int NOT NULL,
    `episode_number` int NOT NULL,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`media_id`) REFERENCES media(`id`) ON DELETE CASCADE,
    CONSTRAINT UNIQUE (`media_id`,`episode_number`) 
);

CREATE TABLE `series_moviedb` (
  `id` int NOT NULL AUTO_INCREMENT,
  `media_id` int NOT NULL,
  `moviedb_id` int NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`media_id`) REFERENCES media(`id`) ON DELETE CASCADE,
  CONSTRAINT UNIQUE (`moviedb_id`)
);

CREATE TABLE `movies_moviedb` (
  `id` int NOT NULL AUTO_INCREMENT,
  `media_id` int NOT NULL,
  `moviedb_id` int NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`media_id`) REFERENCES media(`id`) ON DELETE CASCADE,
  CONSTRAINT UNIQUE (`moviedb_id`)
);



CREATE TABLE `add_file_tasks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `creation_time` datetime DEFAULT CURRENT_TIMESTAMP,
  `file` VARCHAR(255) CHARACTER SET utf8 NOT NULL,
  `brick_id` int NOT NULL,
  `original_name` VARCHAR(255) CHARACTER SET utf8 NOT NULL,
  `working_folder` VARCHAR(255) CHARACTER SET utf8 NOT NULL,
  `media_id` int,
  `user_id` int,
  `stopped` TINYINT(1) DEFAULT 0,
  `had_error` TINYINT(1) DEFAULT 0,
  `msg` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`brick_id`) REFERENCES bricks(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`media_id`) REFERENCES media(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES users(`id`) ON DELETE CASCADE,
  CONSTRAINT UNIQUE (`file`) ,
  CONSTRAINT UNIQUE (`working_folder`) 
);

CREATE TABLE `add_file_subtasks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `task_id` int NOT NULL,
  `command` VARCHAR(4096)  CHARACTER SET utf8 NOT NULL,
  `output` VARCHAR(255)  CHARACTER SET utf8 NOT NULL,
  `done` TINYINT(1) DEFAULT 0,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`task_id`) REFERENCES add_file_tasks(`id`) ON DELETE CASCADE
);

CREATE TABLE `episodes_transcoding_resolutions` (
  `id` int NOT NULL,
  `resolution_id` int NOT NULL,
   PRIMARY KEY (`id`),
   FOREIGN KEY (`resolution_id`) REFERENCES resolutions(`id`) ON DELETE CASCADE,
   CONSTRAINT UNIQUE (`resolution_id`)
);

CREATE TABLE `movies_transcoding_resolutions` (
  `id` int NOT NULL,
  `resolution_id` int NOT NULL,
   PRIMARY KEY (`id`),
   FOREIGN KEY (`resolution_id`) REFERENCES resolutions(`id`) ON DELETE CASCADE,
   CONSTRAINT UNIQUE (`resolution_id`)
);

-- TODO
-- CREATE TABLE `media_genres` (
--   `id` int NOT NULL AUTO_INCREMENT,
--   `media_id` int NOT NULL,
--   `genre_id` int NOT NULL,
--   PRIMARY KEY (`id`),
--   FOREIGN KEY (`media_id`) REFERENCES media(`id`) ON DELETE CASCADE,
--   FOREIGN KEY (`genre_id`) REFERENCES genres(`id`) ON DELETE CASCADE,
--   CONSTRAINT UNIQUE (`media_id`,`genre_id`) 
-- );

-- TODO use it
CREATE TABLE `media_progressions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `media_id` int NOT NULL,
  `audio_lang` int,
  `subtitle_lang` int,
  `progression` float DEFAULT '0.0',
  `last_seen` datetime DEFAULT CURRENT_TIMESTAMP,
  `watched` TINYINT(1) NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`user_id`) REFERENCES users(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`media_id`) REFERENCES media(`id`) ON DELETE CASCADE
);

-- TODO
-- CREATE TABLE `users_settings` (
--   `id` int NOT NULL AUTO_INCREMENT,
--   `user_id` int NOT NULL,
--   `interface_lang` int(10) UNSIGNED DEFAULT 1,
--   `audio_lang` int(10) UNSIGNED DEFAULT 0,
--   `subtitle_lang` int(10) UNSIGNED DEFAULT 1,
--   `subtitle_enabled` TINYINT(1) DEFAULT 0,
--   PRIMARY KEY (`id`),
--   FOREIGN KEY (`user_id`) REFERENCES users(`id`) ON DELETE CASCADE,
--   FOREIGN KEY (`interface_lang`) REFERENCES languages(`id`),
--   FOREIGN KEY (`audio_lang`) REFERENCES languages(`id`),
--   FOREIGN KEY (`subtitle_lang`) REFERENCES languages(`id`)
-- );

CREATE TABLE `ffmpeg_workers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ipv4` INT UNSIGNED NOT NULL,
  `port` INT UNSIGNED NOT NULL,
  `enabled` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT UNIQUE (`ipv4`,`port`)
);

CREATE TABLE `value_types` (
  `id` int NOT NULL,
  `setting_type` varchar(50) NOT NULL,
   PRIMARY KEY (`id`)
);

CREATE TABLE `global_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `key` varchar(50),
  `type` int,
  `string` varchar(50),
  `int` int,
  `float` float,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`type`) REFERENCES value_types(`id`)
) AUTO_INCREMENT=10 ;

-- INSERTIONS
INSERT INTO `value_types` VALUES(1, 'string');
INSERT INTO `value_types` VALUES(2, 'int');
INSERT INTO `value_types` VALUES(3, 'float');

INSERT INTO `global_settings` VALUES(1, 'new_video_brick', 2,NULL,NULL,NULL);
INSERT INTO `global_settings` VALUES(2, 'upload_brick', 2,NULL,NULL,NULL);
INSERT INTO `global_settings` VALUES(3, 'segment_duration', 2,NULL,4,NULL);
INSERT INTO `global_settings` VALUES(5, 'encoder_h264_profile', 1,"main",NULL,NULL);
INSERT INTO `global_settings` VALUES(6, 'encoder_h264_preset', 1,"slow",NULL,NULL);
INSERT INTO `global_settings` VALUES(7, 'tmdb_api_key', 1,"",NULL,NULL);

-- permissions
INSERT INTO `permissions` VALUES(1, 'manage_workers');
INSERT INTO `permissions` VALUES(2, 'manage_transcoding');
INSERT INTO `permissions` VALUES(3, 'manage_users');
INSERT INTO `permissions` VALUES(4, 'manage_content');
INSERT INTO `permissions` VALUES(5, 'add_media');
INSERT INTO `permissions` VALUES(6, 'add_media_request');
INSERT INTO `permissions` VALUES(7, 'upload_content');
INSERT INTO `permissions` VALUES(8, 'manage_bricks');
INSERT INTO `permissions` VALUES(9, 'manage_settings');

-- roles
INSERT INTO `roles` VALUES(1, 'admin');
INSERT INTO `roles` VALUES(2, 'user');
INSERT INTO `roles` VALUES(3, 'guest');

-- roles permissions
-- admin role
INSERT INTO `roles_permissions` (`role_id`,`permission_id`) VALUES(1,1);
INSERT INTO `roles_permissions` (`role_id`,`permission_id`) VALUES(1,2);
INSERT INTO `roles_permissions` (`role_id`,`permission_id`) VALUES(1,3);
INSERT INTO `roles_permissions` (`role_id`,`permission_id`) VALUES(1,4);
INSERT INTO `roles_permissions` (`role_id`,`permission_id`) VALUES(1,5);
INSERT INTO `roles_permissions` (`role_id`,`permission_id`) VALUES(1,6);
INSERT INTO `roles_permissions` (`role_id`,`permission_id`) VALUES(1,7);
INSERT INTO `roles_permissions` (`role_id`,`permission_id`) VALUES(1,8);
INSERT INTO `roles_permissions` (`role_id`,`permission_id`) VALUES(1,9);
-- users role
INSERT INTO `roles_permissions` (`role_id`,`permission_id`) VALUES(2,5);
INSERT INTO `roles_permissions` (`role_id`,`permission_id`) VALUES(2,6);
INSERT INTO `roles_permissions` (`role_id`,`permission_id`) VALUES(2,7);
-- guest role

-- category
INSERT INTO `categories` (`id`,`category`) VALUES( 1, 'series');
INSERT INTO `categories` (`id`,`category`) VALUES( 2, 'seasons');
INSERT INTO `categories` (`id`,`category`) VALUES( 3, 'episodes');
INSERT INTO `categories` (`id`,`category`) VALUES( 4, 'movies');

-- resolutions
INSERT INTO `resolutions` VALUES(1, 'LOW', 1,1);
INSERT INTO `resolutions` VALUES(2, '480p', 854,480);
INSERT INTO `resolutions` VALUES(3, 'HD', 1280,720);
INSERT INTO `resolutions` VALUES(4, 'FHD', 1920,1080);
INSERT INTO `resolutions` VALUES(5, 'UHD', 3840,2160);
INSERT INTO `resolutions` VALUES(6, '4K', 4096,2160);

INSERT INTO `resolutions_bitrates` VALUES(1, 1,800);
INSERT INTO `resolutions_bitrates` VALUES(2, 2,1000);
INSERT INTO `resolutions_bitrates` VALUES(3, 3,2000);
INSERT INTO `resolutions_bitrates` VALUES(4, 4,4000);
INSERT INTO `resolutions_bitrates` VALUES(5, 5,12000);
INSERT INTO `resolutions_bitrates` VALUES(6, 6,13000);

INSERT INTO `audio_bitrates` VALUES(1, 'Mono', 1, 128);
INSERT INTO `audio_bitrates` VALUES(2, 'Stereo', 2, 384);
INSERT INTO `audio_bitrates` VALUES(3, '2.1', 3, 384);
INSERT INTO `audio_bitrates` VALUES(4, '5.1', 6, 512);


-- transcoding resolutions
INSERT INTO `movies_transcoding_resolutions` VALUES(1, 4);
INSERT INTO `movies_transcoding_resolutions` VALUES(2, 3);
INSERT INTO `movies_transcoding_resolutions` VALUES(3, 2);

INSERT INTO `episodes_transcoding_resolutions` VALUES(1, 3);
INSERT INTO `episodes_transcoding_resolutions` VALUES(2, 2);

-- dev
-- INSERT INTO `bricks` (`id`,`brick_alias`,`brick_path`) VALUES( 1, 'brick_upload','/data/upload');
-- INSERT INTO `bricks` (`id`,`brick_alias`,`brick_path`) VALUES( 2, 'brick1','/data/streamy');

-- UPDATE `global_settings` SET `int` = 1 WHERE `key` = 'new_video_brick' ;
-- UPDATE `global_settings` SET `int` = 1 WHERE `key` = 'upload_brick' ;
-- INSERT INTO `ffmpeg_workers` (`ipv4`,`port`,`enabled`) VALUES (INET_ATON("127.0.0.1"),7000,1);

