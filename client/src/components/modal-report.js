import { html, render } from 'lit-html'
import i18next from 'i18next'
import randomcolor from 'randomcolor'
import WordCloud from 'wordcloud'

import { postXhr, getXhr } from '../libs/actions.js'
import store from '../libs/store.js'

export class ModalReport extends HTMLElement {
	constructor() {
		super()

		this.url = ``
		this.vid = ``
		this.titles = ``
		this.desc = ``
		this.date = ``
		this.viewCount = ``
		this.likeCount = ``

		this.done = false
		this.stateFaceImg = true
		this.comments = null
	}

	connectedCallback() {
		const tag = document.createElement(`script`)
		tag.src = `https://www.youtube.com/iframe_api`
		const firstScriptTag = document.getElementsByTagName(`script`)[0]
		firstScriptTag.parentNode.insertBefore(tag, firstScriptTag)

		window.onYouTubeIframeAPIReady = () => {
			window.player = new YT.Player(`player`, {
				height: `250`,
				width: `300`,
				videoId: `M7lc1UVf-V`,
				events: {
					/* 'onReady': this.onPlayerReady, */
					'onStateChange': this.onPlayerStateChange.bind(this),
				},
				playerVars: {
					fs: 0,
					modestbranding: 1,
					rel: 0,
					showinfo: 0,
				},
			})
		}

		render(this.render(), this)
	}

	onPlayerReady(event) {
		event.target.playVideo()
	}

	onPlayerStateChange(event) {
		if (event.data == YT.PlayerState.PLAYING && !this.done) {
			render(``, this.querySelector(`.sensor-box-wrap`))
		}
	}

	stopVideo() {
		window.player.stopVideo()
	}

	init() {
		render(html`${i18next.t(`MODAL_REPORT_FACE_STATUS_PROCESSING`)}`, this.querySelector(`.face-content`))
		render(html``, this.querySelector(`.content-wrap`))		
		this.querySelector(`.word-chart-box`).style.display = `inline-block`
		this.querySelector(`.comment-box`).style.display = `inline-block`
	}
    
	show(url, vid) {
		this.init()

		this.url = url
		this.style.transform = `scale(1)`
		this.getYoutubeData(vid)
		this.getFaceData(vid)
		window.player.loadVideoById(vid)
		window.setTimeout(() => window.player.pauseVideo(), 2000)

		this.crateCommentBox(vid)
		render(this.render(), this)

		this.createWordChart(vid)
	}

	hide() {
		this.style.transform = `scale(0)`
	}
    
	get clickX() {
		const root = this
		return {
			handleEvent() { 
				root.hide()    
			},
			capture: true,
		}
	}

	get clickFullScreen() {
		const root = this
		return {
			handleEvent() {
				if (document.fullscreenElement) {
					document.exitFullscreen()
				} else {
					root.querySelector(`.player-wrap`).requestFullscreen()
				}				
			},
			capture: true,
		}
	}

	getYoutubeData(vid) {
		const userInfo = store.getState().userInfo
		const db = firebase.firestore()
		db.collection(`userId`).doc(userInfo.uid).get().then(doc => {
			if (doc.exists) {
				Object.values(doc.data()).forEach(each => {
					if (each.vid === vid) {
						this.vid = vid
						this.titles = each.title
						this.viewCount = each.viewCount
						this.date = each.writeDate
						this.desc = each.desc
						this.likeCount = each.likeCount
						render(this.render(), this)
					}
				})
			} else {
				console.error(`No SEACH DB`)
			}
		}).catch(err => {
			console.error(`NO ACCESS DB ${err}`)
		})						
	}

	sensorBox(obj) {
		return html`
		<span 
			class="sensor-box"
			style="
			top: calc(${obj.bottom} * 100%);
			left: calc(${obj.left} * 100%);
			width: calc(${obj.width} * 100%);
			height: calc(${obj.height} * 100%);
			border: 3px solid ${obj.color};
			"
			></span>
		`
	}

	get videoBox() {
		return html `
		<span class="video-box">
			<h2 class="video-title"><i class="fi-play-video size-72"></i> Video Info</h2>
			<!-- <iframe width="300" height="250" .src=${this.url} frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe> -->
			<div class="player-wrap">
				<div id="player"></div>
				<i class="fi-arrows-out size-72 player-full-screen" @click=${this.clickFullScreen}></i>
				<span class="sensor-box-wrap"></span>
			</div>			
			<h2 class="video-desc">Information</h2>
			<div class="video-desc">
				<span class="desc-title">Title:</span>
				<span class="desc-content title">${this.titles}</span>
			</div>
			<div class="video-desc">
				<span class="desc-title">Date:</span>
				<span class="desc-content">${this.date}</span>
			</div>
			<div class="video-desc">
				<span class="desc-title">Describe:</span>
				<span class="desc-content desc">${this.desc}</span>
			</div>
			<div class="video-desc">
				<span class="desc-title">View Count:</span>
				<span class="desc-content">${this.viewCount}</span>
			</div>
			<div class="video-desc">
				<span class="desc-title">Like Count:</span>
				<span class="desc-content">${this.likeCount}</span>
			</div>
		</span>
		`
	}

	async getFaceData(vid) {
		const uid = store.getState().userInfo.uid
		const formData = new FormData()
		formData.append(`uid`, uid)
		formData.append(`vid`, vid)

		try {
			const res = await postXhr(`/download/`, formData)

			const status = JSON.parse(res)[`status`]
			const isProcessing = () => status === `wait` || status === `processing`

			if (isProcessing()) {
				render(html `${i18next.t(`MODAL_REPORT_FACE_STATUS_PROCESSING`)}`, this.querySelector(`.face-content`))	
			} else if (status === `complete`) {
				const data = Object.values(JSON.parse(JSON.parse(res)[`time_line`]))
				const imgCount = data.length		

				render(html `
					${imgCount}개의 이미지가 검색됨
				`, this.querySelector(`.face-img-count`))
				
				render(html `
					${data.map((img, index) => html`
					<img
						@click=${this.mouseclickFaceImg(index, data)}
						@mouseenter=${this.mouseenterFaceImg(index, data)}
						@mouseleave=${this.mouseleaveFaceImg}
						class="face-img" 
						style="border: 5px solid ${randomcolor({luminosity: `dark`})}" 
						src="https://open-tube.kro.kr/img-face/${uid}/${vid}/${index}.jpg"/>
					`)}
				`, this.querySelector(`.face-content`))
			}

		} catch(err) {
			render(html `${i18next.t(`MODAL_REPORT_FACE_STATUS_PROCESSING`)}`, this.querySelector(`.face-content`))	
		}		
	}	

	mouseclickFaceImg(index, data) {
		const root = this
		return {
			handleEvent(event) {
				const infoBox = root.querySelector(`.face-info-box`)
				const domRect = event.target.getBoundingClientRect()
				event.target.classList.toggle(`active`)
				if (event.target.classList.contains(`active`)) {
					root.stateFaceImg = false
					infoBox.style.pointerEvents = `all`
					infoBox.style.opacity = `0.9`					
					infoBox.style.top = `${domRect.top}px`
					infoBox.style.left = `${domRect.left + domRect.width}px`

					root.renderFaceInfo(data, index)
				} else {
					root.stateFaceImg = true
					infoBox.style.pointerEvents = `none`
				}
			},
			capture: true,
		}
	}

	mouseenterFaceImg(index, data) {
		const root = this
		return {
			handleEvent(event) {				
				if (root.stateFaceImg) {
					const domRect = event.target.getBoundingClientRect()
					const span = root.querySelector(`.face-info-box`)
					span.style.opacity = `0.8`
					span.style.top = `${domRect.top}px`
					span.style.left = `${domRect.left + domRect.width}px`
					
					root.renderFaceInfo(data, index)
				}
			},
			capture: true,
		}
	}

	renderFaceInfo(data, index) {
		data.forEach((img, _index) => {
			if (index === _index) {
				render(html`
				${img.map(time => {
		const obj = Object.entries(time)[0]
		const seconds = obj[0]
		const x = parseFloat(obj[1][0]).toFixed(2)
		const y = parseFloat(obj[1][1]).toFixed(2)
		const width = parseFloat(obj[1][2]).toFixed(2)
		const height = parseFloat(obj[1][3]).toFixed(2)

		return this.timeDesc({
			seconds,
			x,
			y,
			width,
			height,
		})
	})}
				`, this.querySelector(`.time-desc-wrap`))				
			}			
		})
	}

	get mouseleaveFaceImg() {
		const root = this
		return {
			handleEvent() {
				if (root.stateFaceImg) {
					const span = root.querySelector(`.face-info-box`)
					span.style.opacity = `0`
				}
			},
			capture: true,
		}
	}

	get clickFaceImgX() {
		const root = this
		return {
			handleEvent() {
				const infoBox = root.querySelector(`.face-info-box`)
				root.stateFaceImg = true
				infoBox.style.pointerEvents = `none`
			},
			capture: true,
		}
	}

	get clickSeconds() {
		const root = this
		return {
			handleEvent(event) {
				const time = event.target.textContent
				const desc = event.target.closest(`.time-desc`)
				window.player.seekTo(time - 1)
				window.player.pauseVideo()

				render(root.sensorBox({
					left: desc.querySelector(`.x-value`).textContent,
					bottom: desc.querySelector(`.y-value`).textContent,
					width: desc.querySelector(`.width-value`).textContent,
					height: desc.querySelector(`.height-value`).textContent,
					color: randomcolor({luminosity: `dark`}),
				}), root.querySelector(`.sensor-box-wrap`))
			},
			capture: true,
		}
	}

	timeDesc(obj = null) {
		return html`
		<div class="time-desc">
			<div class="desc-seconds"><h5>Seconds</h5><span class="second-detail" @click=${this.clickSeconds}>${obj.seconds}</span></div>
			<div class="desc-x"><h5>X: </h5> <span class="x-value">${obj.x}</span></div>
			<div class="desc-y"><h5>Y: </h5> <span class="y-value">${obj.y}</span></div>
			<div class="desc-width"><h5>Width: </h5> <span class="width-value">${obj.width}</span></div>
			<div class="desc-height"><h5>Height: </h5> <span class="height-value">${obj.height}</span></div>
		</div>
		`
	}

	get faceAnalysisBox() {		
		return html `
		<span class="face-analysis-box">
			<h2 class="title"><i class="fi-social-myspace size-72"></i> Face Analysis</h2>
			<h3 class="title"><i class="fi-photo size-72"></i> All Person Images <span class="face-img-count"></span></h3>
			<div class="face-content"></div>
			<span class="face-info-box">
				<i class="fi-x size-72" @click=${this.clickFaceImgX}></i>
				<h4 class="img-title">Image Time · Position</h4>
				<div class="time-desc-wrap"></div>
			</span>			
		</span>
		`
	}

	comment(obj) {
		return html `
		<div class="content">
			<h3 class="author">${obj.author}</h3>
			<p class="comment">${obj.root}</p>
			<div class="like-count"><i class="fi-like size-72"></i> ${obj.like}</div>
			<div class="sentiment-value" style="color: ${obj.sentiment >= 0.5 ? `#56B37F` : `#E36A5E`}"><i class="fi-contrast size-72"></i> ${obj.sentiment}</div>
			<div class="slang" style="color: ${obj.slang === `1.0` ? `#E36A5E` : `#988E7A`}"><i class="fi-skull size-72"></i> ${obj.slang === `1.0` ? `True` : `False`}</div>
		</div>
		`
	}

	async crateCommentBox(vid) {
		try {
			let res = await getXhr(`/api_reply/${vid}`)

			res = JSON.parse(res)
	
			this.comments = res
	
			render(html `
			${res.length}개의 댓글이 검색됨
			`, this.querySelector(`.comment-count`))
	
			render(html `
			${res.map(comment => this.comment(comment))}
			`, this.querySelector(`.content-wrap`))
		} catch(err) {
			this.querySelector(`.comment-box`).style.display = `none`
		}		
	}

	clickAlignComment(align = `index`) {
		const root = this
		return {
			handleEvent(event) {
				const i = event.currentTarget.querySelector(`i`)
				let num

				if (i.classList.contains(`fi-arrow-up`)) {
					i.classList.remove(`fi-arrow-up`)
					i.classList.add(`fi-arrow-down`)
					num = -1
				} else {
					i.classList.remove(`fi-arrow-down`)
					i.classList.add(`fi-arrow-up`)
					num = 1
				}

				root.comments.sort((a, b) => {
					if (a[align] > b[align]) {
						return num
					}
					if (a[align] < b[align]) {
						return -num
					}
					return 0
				})
				
				render(html `
				${root.comments.map(comment => root.comment(comment))}
				`, root.querySelector(`.content-wrap`))

				root.querySelectorAll(`.title.sub i`).forEach(_i => {
					_i.classList.add(`none`)
				})				
				i.classList.remove(`none`)
			},
			capture: true,
		}
	}

	get commentBox() {		
		return html `
		<span class="comment-box">
			<h2 class="title"><i class="fi-comment-quotes size-72"></i> Comment Analysis <span class="comment-count"></span></h2>
			<h2 class="title sub">
				<span class="title-comment" @click=${this.clickAlignComment()}>Comments <i class="fi-arrow-up size-36"></i></span>
				<span class="sentiment-value" @click=${this.clickAlignComment(`sentiment`)}>Sentiment Value <i class="fi-arrow-up size-36 none"></i></span>
				<span class="slang-value" @click=${this.clickAlignComment(`slang`)}>Slang Boolean <i class="fi-arrow-up size-36 none"></i></span>
			</h2>
			<div class="content-wrap"></div>
		</span>
		`
	}

	async createWordChart(vid) {
		try {
			let res = await getXhr(`/api_keywords/${vid}`)

			res = JSON.parse(res)
			res = Object.entries(res)

			res.forEach(each => {
				each[1] *= 20
			})

			WordCloud(document.querySelector(`#word_cloud`), { list: res } )
		} catch(err) {
			this.querySelector(`.word-chart-box`).style.display = `none`
		}		
	}

	get wordChart() {		
		return html`
		<span class="word-chart-box">
			<h2 class="title"><i class="fi-graph-trend size-72"></i> Keyword Analysis</span></h2>
			<canvas id="word_cloud" class="word_cloud" width="1280" height="800"></canvas>
		</span>
		`
	}

	render() {
		return html`
        <div class="modal-report"> 
			<i class="fi-x size-72" @click=${this.clickX}></i>
			<div class="modal-header">					
				<h1 class="modal-title"><i class="fi-results size-72"></i> Reports</h1>
			</div>
            <div class="modal-body">								

				${this.videoBox}

				${this.faceAnalysisBox}

				${this.commentBox}

				${this.wordChart}

			</div>
			<div class="modal-footer">© 2019 Open-Tube, Inc.</div>
        </div>
        `
	}
}

customElements.define(`modal-report`, ModalReport)
