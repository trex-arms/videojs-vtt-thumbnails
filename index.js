import { version as VERSION } from './package.json'

// Default options for the plugin.
const defaults = {}

// Cache for image elements
const cache = {}

/**
 * VTT Thumbnails class.
 *
 * This class performs all functions related to displaying the vtt
 * thumbnails.
 */
class vttThumbnailsPlugin {
	/**
	 * Plugin class constructor, called by videojs on
	 * ready event.
	 *
	 * @function  constructor
	 * @param    {Player} player
	 *           A Video.js player object.
	 *
	 * @param    {Object} [options={}]
	 *           A plain object containing options for the plugin.
	 */
	constructor(player, options, videojs) {
		this.player = player
		this.options = options
		this.videojs = videojs
		this.listenForDurationChange()
		this.initializeThumbnails()
		this.registeredEvents = {}
		return this
	}

	src(source) {
		this.resetPlugin()
		this.options.src = source
		this.initializeThumbnails()
	}

	detach() {
		this.resetPlugin()
	}

	resetPlugin() {
		if (this.thumbnailHolder) {
			this.thumbnailHolder.parentNode.removeChild(this.thumbnailHolder)
		}

		if (this.progressBar) {
			this.progressBar.removeEventListener(`mouseenter`, this.registeredEvents.progressBarMouseEnter)
			this.progressBar.removeEventListener(`touchstart`, this.registeredEvents.progressBarMouseEnter)
			this.progressBar.removeEventListener(`touchend`, this.registeredEvents.progressBarMouseLeave)
			this.progressBar.removeEventListener(`mouseleave`, this.registeredEvents.progressBarMouseLeave)

			this.progressBar.removeEventListener(`mousemove`, this.registeredEvents.progressBarMouseMove)
			this.progressBar.removeEventListener(`touchmove`, this.registeredEvents.progressBarMouseMove)
		}

		if (this.progressHolder) {
			this.progressHolder.removeEventListener(`mouseenter`, this.registeredEvents.progressBarMouseEnter)
			this.progressHolder.removeEventListener(`touchstart`, this.registeredEvents.progressBarMouseEnter)
			this.progressHolder.removeEventListener(`touchend`, this.registeredEvents.progressBarMouseLeave)

			this.progressHolder.removeEventListener(`mousemove`, this.registeredEvents.progressBarMouseMove)
			this.progressHolder.removeEventListener(`touchmove`, this.registeredEvents.progressBarMouseMove)
		}

		delete this.registeredEvents.progressBarMouseEnter
		delete this.registeredEvents.progressBarMouseLeave
		delete this.registeredEvents.progressBarMouseMove
		delete this.progressBar
		delete this.vttData
		delete this.thumbnailHolder
		delete this.lastStyle
	}

	listenForDurationChange() {
		this.player.on(`durationchange`, () => {

		})
	}

	/**
	 * Bootstrap the plugin.
	 */
	initializeThumbnails() {
		if (!this.options.src) {
			return
		}

		const baseUrl = this.getBaseUrl()
		const url = this.getFullyQualifiedUrl(this.options.src, baseUrl)

		this.getVttFile(url)
			.then(data => {
				this.vttData = this.processVtt(data)
				this.setupThumbnailElement()
			})
	}

	/**
	 * Builds a base URL should we require one.
	 *
	 * @return {string}
	 */
	getBaseUrl() {
		return [
			// eslint-disable-next-line no-undef
			window.location.protocol,
			`//`,
			// eslint-disable-next-line no-undef
			window.location.hostname,
			// eslint-disable-next-line no-undef
			(window.location.port ? `:` + window.location.port : ``),
			// eslint-disable-next-line no-undef
			window.location.pathname,
		].join(``).split(/([^\/]*)$/gi).shift()
	}

	/**
	 * Grabs the contents of the VTT file.
	 *
	 * @param url
	 * @return {Promise}
	 */
	getVttFile(url) {
		return new Promise((resolve, reject) => {
			// eslint-disable-next-line no-undef
			const req = new XMLHttpRequest()

			req.data = {
				resolve,
			}

			req.addEventListener(`load`, this.vttFileLoaded)
			req.open(`GET`, url)
			req.overrideMimeType(`text/plain; charset=utf-8`)
			req.send()
		})
	}

	/**
	 * Callback for loaded VTT file.
	 */
	vttFileLoaded() {
		this.data.resolve(this.responseText)
	}

	setupThumbnailElement(data) {
		// eslint-disable-next-line no-undef
		const thumbHolder = document.createElement(`div`)

		thumbHolder.setAttribute(`class`, `vjs-vtt-thumbnail-display`)
		this.progressBar = this.player.$(`.vjs-progress-control`)
		this.progressHolder = this.player.$(`.vjs-progress-holder`)

		this.progressBar.appendChild(thumbHolder)
		this.thumbnailHolder = thumbHolder

		this.registeredEvents.progressBarMouseEnter = () => this.onBarMouseenter()

		this.registeredEvents.progressBarMouseLeave = () => this.onBarMouseleave()

		this.progressBar.addEventListener(`mouseenter`, this.registeredEvents.progressBarMouseEnter)
		this.progressBar.addEventListener(`touchstart`, this.registeredEvents.progressBarMouseEnter)
		this.progressBar.addEventListener(`touchend`, this.registeredEvents.progressBarMouseLeave)
		this.progressBar.addEventListener(`mouseleave`, this.registeredEvents.progressBarMouseLeave)

		this.progressHolder.addEventListener(`mouseenter`, this.registeredEvents.progressBarMouseEnter)
		this.progressHolder.addEventListener(`touchstart`, this.registeredEvents.progressBarMouseEnter)
		this.progressHolder.addEventListener(`touchend`, this.registeredEvents.progressBarMouseLeave)
	}

	onBarMouseenter() {
		this.mouseMoveCallback = e => {
			this.onBarMousemove(e)
		}

		this.registeredEvents.progressBarMouseMove = this.mouseMoveCallback

		this.progressBar.addEventListener(`mousemove`, this.registeredEvents.progressBarMouseMove)
		this.progressBar.addEventListener(`touchmove`, this.registeredEvents.progressBarMouseMove)

		this.progressHolder.addEventListener(`mousemove`, this.registeredEvents.progressBarMouseMove)
		this.progressHolder.addEventListener(`touchmove`, this.registeredEvents.progressBarMouseMove)

		this.showThumbnailHolder()
	}

	onBarMouseleave() {
		if (this.registeredEvents.progressBarMouseMove) {
			this.progressBar.removeEventListener(`mousemove`, this.registeredEvents.progressBarMouseMove)
			this.progressBar.removeEventListener(`touchmove`, this.registeredEvents.progressBarMouseMove)

			this.progressHolder.removeEventListener(`mousemove`, this.registeredEvents.progressBarMouseMove)
			this.progressHolder.removeEventListener(`touchmove`, this.registeredEvents.progressBarMouseMove)
		}

		this.hideThumbnailHolder()
	}

	getXCoord(bar, mouseX) {
		const rect = bar.getBoundingClientRect()
		// eslint-disable-next-line no-undef
		const docEl = document.documentElement

		// eslint-disable-next-line no-undef
		return mouseX - (rect.left + (window.pageXOffset || docEl.scrollLeft || 0))
	}

	onBarMousemove(event) {
		this.updateThumbnailStyle(
			this.videojs.dom.getPointerPosition(this.progressBar, event).x,
		)
	}

	getStyleForTime(time) {
		for (let i = 0; i < this.vttData.length; ++i) {
			const item = this.vttData[i]

			if (time >= item.start && time < item.end) {
				// Cache miss
				if (item.css.url && !cache[item.css.url]) {
					// eslint-disable-next-line no-undef
					const image = new Image()

					image.src = item.css.url
					cache[item.css.url] = image
				}

				return item.css
			}
		}
	}

	showThumbnailHolder() {
		this.thumbnailHolder.classList.remove(`hidden`)
	}

	hideThumbnailHolder() {
		this.thumbnailHolder.classList.add(`hidden`)
	}

	updateThumbnailStyle(percent) {
		const duration = this.player.duration()
		const time = percent * duration
		const currentStyle = this.getStyleForTime(time)

		if (!currentStyle) {
			return this.hideThumbnailHolder()
		}

		const width = this.player.currentWidth()

		const xPos = percent * width
		const thumbnailWidth = parseInt(currentStyle.width, 10)
		const scale = Math.min((width / 4) / thumbnailWidth, 0.5)
		const halfthumbnailWidth = thumbnailWidth >> 1
		const marginRight = width - (xPos + (halfthumbnailWidth * scale))
		const marginLeft = (xPos - (halfthumbnailWidth * scale))
		const thumbnailHeight = parseInt(currentStyle.height, 10)

		if (marginLeft > 0 && marginRight > 0) {
			this.thumbnailHolder.style.transform = `translateX(${xPos - halfthumbnailWidth}px)`
		} else if (marginLeft <= 0) {
			this.thumbnailHolder.style.transform = `translateX(${(xPos - halfthumbnailWidth) - marginLeft}px)`
		} else if (marginRight <= 0) {
			this.thumbnailHolder.style.transform = `translateX(${(width - halfthumbnailWidth) - (halfthumbnailWidth * scale)}px)`
		}

		this.thumbnailHolder.style.transform = `${this.thumbnailHolder.style.transform} scale(${scale})`
		this.thumbnailHolder.style.bottom = `${-((thumbnailHeight - (thumbnailHeight * scale)) / 2) + 50}px`

		if (this.lastStyle && this.lastStyle === currentStyle) {
			return
		}

		this.lastStyle = currentStyle

		for (const style in currentStyle) {
			if (currentStyle.hasOwnProperty(style)) {
				this.thumbnailHolder.style[style] = currentStyle[style]
			}
		}
	}

	processVtt(data) {
		const processedVtts = []
		const vttDefinitions = data.split(/[\r\n][\r\n]/i)

		vttDefinitions.forEach(vttDef => {
			if (vttDef.match(/([0-9]{2}:)?([0-9]{2}:)?[0-9]{2}(.[0-9]{3})?( ?--> ?)([0-9]{2}:)?([0-9]{2}:)?[0-9]{2}(.[0-9]{3})?[\r\n]{1}.*/gi)) {
				const vttDefSplit = vttDef.split(/[\r\n]/i)
				const vttTiming = vttDefSplit[0]
				const vttTimingSplit = vttTiming.split(/ ?--> ?/i)
				const vttTimeStart = vttTimingSplit[0]
				const vttTimeEnd = vttTimingSplit[1]
				const vttImageDef = vttDefSplit[1]
				const vttCssDef = this.getVttCss(vttImageDef)

				processedVtts.push({
					start: this.getSecondsFromTimestamp(vttTimeStart),
					end: this.getSecondsFromTimestamp(vttTimeEnd),
					css: vttCssDef,
				})
			}
		})

		return processedVtts
	}

	getFullyQualifiedUrl(path, base) {
		if (path.indexOf(`//`) >= 0) {
			// We have a fully qualified path.
			return path
		}

		if (base.indexOf(`//`) === 0) {
			// We don't have a fully qualified path, but need to
			// be careful with trimming.
			return [
				base.replace(/\/$/gi, ``),
				this.trim(path, `/`),
			].join(`/`)
		}

		if (base.indexOf(`//`) > 0) {
			// We don't have a fully qualified path, and should
			// trim both sides of base and path.
			return [
				this.trim(base, `/`),
				this.trim(path, `/`),
			].join(`/`)
		}

		// If all else fails.
		return path
	}

	getPropsFromDef(def) {
		const imageDefSplit = def.split(/#xywh=/i)
		const imageUrl = imageDefSplit[0]
		const imageCoords = imageDefSplit[1]
		const splitCoords = imageCoords.match(/[0-9]+/gi)

		return {
			x: splitCoords[0],
			y: splitCoords[1],
			w: splitCoords[2],
			h: splitCoords[3],
			image: imageUrl,
		}
	}

	getVttCss(vttImageDef) {
		const cssObj = {}

		// If there isn't a protocol, use the VTT source URL.
		let baseSplit

		if (this.options.src.indexOf(`//`) >= 0) {
			baseSplit = this.options.src.split(/([^\/]*)$/gi).shift()
		} else {
			baseSplit = this.getBaseUrl() + this.options.src.split(/([^\/]*)$/gi).shift()
		}

		vttImageDef = this.getFullyQualifiedUrl(vttImageDef, baseSplit)

		if (!vttImageDef.match(/#xywh=/i)) {
			cssObj.background = `url("` + vttImageDef + `")`
			return cssObj
		}

		const imageProps = this.getPropsFromDef(vttImageDef)

		cssObj.background = `url("` + imageProps.image + `") no-repeat -` + imageProps.x + `px -` + imageProps.y + `px`
		cssObj.width = imageProps.w + `px`
		cssObj.height = imageProps.h + `px`
		cssObj.url = imageProps.image

		return cssObj
	}

	/**
	 * deconstructTimestamp deconstructs a VTT timestamp
	 *
	 * @param  {string} timestamp VTT timestamp
	 * @return {Object}           deconstructed timestamp
	 */
	deconstructTimestamp(timestamp) {
		const splitStampMilliseconds = timestamp.split(`.`)
		const timeParts = splitStampMilliseconds[0]
		const timePartsSplit = timeParts.split(`:`)

		return {
			milliseconds: parseInt(splitStampMilliseconds[1], 10) || 0,
			seconds: parseInt(timePartsSplit.pop(), 10) || 0,
			minutes: parseInt(timePartsSplit.pop(), 10) || 0,
			hours: parseInt(timePartsSplit.pop(), 10) || 0,
		}
	}

	/**
	 * getSecondsFromTimestamp
	 *
	 * @param  {string} timestamp VTT timestamp
	 * @return {number}           timestamp in seconds
	 */
	getSecondsFromTimestamp(timestamp) {
		const timestampParts = this.deconstructTimestamp(timestamp)

		return parseInt((timestampParts.hours * (60 * 60))
			+ (timestampParts.minutes * 60)
			+ timestampParts.seconds
			+ (timestampParts.milliseconds / 1000), 10)
	}

	/**
	 * trim
	 *
	 * @param  {string} str      source string
	 * @param  {string} charlist characters to trim from text
	 * @return {string}          trimmed string
	 */
	trim(str, charlist) {
		let whitespace = [
			` `,
			`\n`,
			`\r`,
			`\t`,
			`\f`,
			`\x0b`,
			`\xa0`,
			`\u2000`,
			`\u2001`,
			`\u2002`,
			`\u2003`,
			`\u2004`,
			`\u2005`,
			`\u2006`,
			`\u2007`,
			`\u2008`,
			`\u2009`,
			`\u200a`,
			`\u200b`,
			`\u2028`,
			`\u2029`,
			`\u3000`,
		].join(``)
		let l = 0
		let i = 0

		str += ``
		if (charlist) {
			whitespace = (charlist + ``).replace(/([[\]().?/*{}+$^:])/g, `$1`)
		}
		l = str.length
		for (i = 0; i < l; i++) {
			if (whitespace.indexOf(str.charAt(i)) === -1) {
				str = str.substring(i)
				break
			}
		}
		l = str.length
		for (i = l - 1; i >= 0; i--) {
			if (whitespace.indexOf(str.charAt(i)) === -1) {
				str = str.substring(0, i + 1)
				break
			}
		}
		return whitespace.indexOf(str.charAt(0)) === -1 ? str : ``
	}
}

export default videojs => {
	const vttThumbnails = function(options) {
		this.ready(() => {
			this.addClass(`vjs-vtt-thumbnails`)
			this.vttThumbnails = new vttThumbnailsPlugin(this, videojs.mergeOptions(defaults, options), videojs)
		})
	}

	// Include the version number.
	vttThumbnails.VERSION = VERSION

	// Register the plugin with video.js.
	videojs.registerPlugin(`vttThumbnails`, vttThumbnails)

	return vttThumbnails
}
