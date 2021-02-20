# videojs-vtt-thumbnails

Video.js plugin that displays thumbnails on progress bar hover, driven by external VTT files.  Based on [this JW Player spec](https://support.jwplayer.com/customer/portal/articles/1407439-adding-preview-thumbnails). Note, this plugin currently only supports sprited thumbnails.

## Installation

```sh
npm install --save videojs-vtt-thumbnails
```

## Usage

npm install videojs-vtt-thumbnails via github (`github:trex-arms/videojs-vtt-thumbnails`) and `import` the plugin as you would any other ESM module.

```js
import videojs from 'video.js'
import register_vtt_thumbnails from 'videojs-vtt-thumbnails'
import 'videojs-vtt-thumbnails/index.css' // your bundler must be configured to handle this

register_vtt_thumbnails(videojs)

const player = videojs(target)

player.vttThumbnails({
	src: `https://image.mux.com/${mux_playback_id}/storyboard.vtt`,
})
```
