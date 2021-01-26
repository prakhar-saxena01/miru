const controls = document.getElementsByClassName('ctrl')

for (let item of controls) {
    item.addEventListener("click", function () {
        let func = this.dataset.name;
        window[func]()
    })
}

// video element shit
video.addEventListener("playing", resetBuffer);
video.addEventListener("canplay", resetBuffer);
video.addEventListener("loadeddata", initThumbnail);
video.onloadedmetadata = () => {
    updateDisplay();
    (video.audioTracks && video.audioTracks.length > 1) ? baudio.removeAttribute("disabled") : baudio.setAttribute("disablePictureInPicture", "")
}
video.onended = () => {
    updateBar(video.currentTime / video.duration * 100)
    if (settings.player6 && parseInt(playerData.nowPlaying[1]) < playerData.nowPlaying[0].episodes) btnnext()
}
video.addEventListener("waiting", isBuffering);
video.ontimeupdate = () => {
    updateDisplay();
    checkCompletion();
    if ('setPositionState' in navigator.mediaSession) updatePositionState();
}

if (!'pictureInPictureEnabled' in document) {
    video.setAttribute("disablePictureInPicture", "")
    bpip.setAttribute("disabled", "")
} else {
    bpip.removeAttribute("disabled")
    video.addEventListener("enterpictureinpicture", () => { if (playerData.octopusInstance) btnpip() })
}

let playerData = {}

function cleanupVideo() { // cleans up objects, attemps to clear as much video caching as possible
    if (playerData.octopusInstance) playerData.octopusInstance.dispose()
    if (playerData.fonts) playerData.fonts.forEach(file => URL.revokeObjectURL(file))
    if (dl.href) URL.revokeObjectURL(dl.href)
    dl.setAttribute("disabled", "")
    dl.onclick = undefined
    video.poster = ""
    //some attemt at cache clearing
    video.pause()
    video.src = "";
    video.load()
    // if (typeof client !== 'undefined' && client.torrents[0] && client.torrents[0].files.length > 1) {
    //     client.torrents[0].files.forEach(file => file.deselect());
    //     client.torrents[0].deselect(0, client.torrents[0].pieces.length - 1, false);
    // console.log(videoFiles.filter(file => `${scope}webtorrent/${client.torrents[0].infoHash}/${encodeURI(file.path)}` == video.src))
    // look for file and delete its store
    // }
    playerData = {
        subtitles: [],
        fonts: []
    }
    nowPlayingDisplay.innerHTML = ""
    bcap.setAttribute("disabled", "")
    bpl.setAttribute("disabled", "")
    document.querySelector(".playlist").innerHTML = '';
    bnext.removeAttribute("disabled")
    navNowPlaying.classList.add("d-none")
    if ('mediaSession' in navigator) navigator.mediaSession.metadata = null
}

async function buildVideo(torrent, opts) { // sets video source and creates a bunch of other media stuff
    if (videoFiles.length > 1) {
        if (!torrent.store.store._idbkvStore) {
            torrent.files.forEach(file => file.deselect());
            torrent.deselect(0, torrent.pieces.length - 1, false);
        }
        bpl.removeAttribute("disabled")
        let frag = document.createDocumentFragment()
        for (let file of videoFiles) {
            let mediaInformation = await resolveFileMedia({ fileName: file.name, method: "SearchName" })
            template = cardCreator(mediaInformation)
            template.onclick = async () => {
                addTorrent(torrent, { media: mediaInformation.media, episode: mediaInformation.parseObject.episode, file: file })
                store[mediaInformation.parseObject.anime_title] = await alRequest({ id: mediaInformation.media.id, method: "SearchIDSingle" }).then(res => res.data.Media)
                // force updates entry data on play in case its outdated, needs to be made cleaner and somewhere else...
            }
            frag.appendChild(template)
        }
        document.querySelector(".playlist").appendChild(frag)
    }
    console.log(opts.file)
    //play wanted episode from opts, or the 1st episode, or 1st file [batches: plays wanted episode, single: plays the only episode, manually added: plays first or only file]
    let selectedFile = opts.file || videoFiles.filter(async file => await anitomyscript(file.name).then(object => Number(object.episode_number) == opts.episode || 1))[0] || videoFiles[0]
    video.src = `${scope}webtorrent/${torrent.infoHash}/${encodeURI(selectedFile.path)}`
    video.load();
    playVideo();
    function processFile() {
        halfmoon.initStickyAlert({
            content: `<span class="text-break">${selectedFile.name}</span> has finished downloading. Now seeding.`,
            title: "Download Complete",
            alertType: "alert-success",
            fillType: ""
        });
        postDownload(selectedFile)
        if (!torrent.store.store._store) {
            if (settings.player8) {
                finishThumbnails(selectedFile);
            }
            downloadFile(selectedFile)
        }
    }
    if (selectedFile.done) {
        processFile()
    } else {
        playerData.onDone = selectedFile.on("done", () => {
            processFile()
        })
    }
    playerData.onProgress = () => {
        if (document.location.hash == "#player") {
            if (!player.classList.contains('immersed')) {
                player.style.setProperty("--download", selectedFile.progress * 100 + "%");
                peers.innerHTML = torrent.numPeers
                downSpeed.innerHTML = prettyBytes(torrent.downloadSpeed) + '/s'
                upSpeed.innerHTML = prettyBytes(torrent.uploadSpeed) + '/s'
            }
        }
        setTimeout(playerData.onProgress, 100)
    }
    console.log(opts)
    setTimeout(playerData.onProgress, 100)
    if (opts.media) {
        playerData.nowPlaying = [opts.media, opts.episode]
        navNowPlaying.classList.remove("d-none")
    } else { // try to resolve name
        let mediaInformation = await resolveFileMedia({ fileName: selectedFile.name, method: "SearchName" })
        playerData.nowPlaying = [mediaInformation.media, mediaInformation.parseObject.episode_number]
        if (mediaInformation.media) {
            navNowPlaying.classList.remove("d-none")
        }
    }
    let mediaMetadata
    // only set mediasession and other shit if the playerdata is parsed correctly
    if (playerData.nowPlaying && playerData.nowPlaying[0] && playerData.nowPlaying[1]) {
        mediaMetadata = new MediaMetadata({
            title: playerData.nowPlaying[0].title.userPreferred,
            artist: `Episode ${parseInt(playerData.nowPlaying[1])}`,
            album: "Miru",
            artwork: [{
                src: playerData.nowPlaying[0].coverImage.medium,
                sizes: '256x256',
                type: 'image/jpg'
            }]
        });
        nowPlayingDisplay.innerHTML = `EP ${parseInt(playerData.nowPlaying[1])}`
        if (parseInt(playerData.nowPlaying[1]) >= playerData.nowPlaying[0].episodes)
            bnext.setAttribute("disabled", "")
        if (playerData.nowPlaying[0].streamingEpisodes.length >= parseInt(playerData.nowPlaying[1])) {
            let streamingEpisode = playerData.nowPlaying[0].streamingEpisodes.filter(episode => episodeRx.exec(episode.title) && episodeRx.exec(episode.title)[1] == parseInt(playerData.nowPlaying[1]))[0]
            video.poster = streamingEpisode.thumbnail
            mediaMetadata.artist = `Episode ${parseInt(playerData.nowPlaying[1])} - ${episodeRx.exec(streamingEpisode.title)[2]}`
            mediaMetadata.artwork = [{
                src: streamingEpisode.thumbnail,
                sizes: '256x256',
                type: 'image/jpg'
            }]
            nowPlayingDisplay.innerHTML = `EP ${parseInt(playerData.nowPlaying[1])} - ${episodeRx.exec(streamingEpisode.title)[2]}`
        }
    }
    if ('mediaSession' in navigator && mediaMetadata) navigator.mediaSession.metadata = mediaMetadata
}

// visibility loss pause
if (settings.player10) document.addEventListener("visibilitychange", () => {
    if (!video.ended) document.visibilityState === "hidden" ? video.pause() : playVideo();
})

// progress seek bar and display

progress.addEventListener("input", dragBar);
progress.addEventListener("mouseup", dragBarEnd);
progress.addEventListener("touchend", dragBarEnd);
progress.addEventListener("click", dragBarEnd);
progress.addEventListener("mousedown", dragBarStart);

function updateDisplay() {
    if (!player.classList.contains('immersed') && document.location.hash == "#player") {
        progress.style.setProperty("--buffer", video.buffered.length == 0 ? 0 : video.buffered.end(video.buffered.length - 1) / video.duration * 100 + "%");
        updateBar((video.currentTime / video.duration * 100) || progress.value / 10);
    }
    createThumbnail(video);
}

function dragBar() {
    updateBar(progress.value / 10)
    video.pause()
    thumb.src = playerData.thumbnails[Math.floor(currentTime / 5)] || " "
}

function dragBarEnd() {
    video.currentTime = currentTime || 0
    playVideo()
}

async function dragBarStart() {
    await video.pause()
    updateBar(progress.value / 10)
}

let currentTime = 0;
function updateBar(progressPercent) {
    progress.style.setProperty("--progress", progressPercent + "%");
    thumb.style.setProperty("--progress", progressPercent + "%");
    currentTime = video.duration * progressPercent / 100
    elapsed.innerHTML = toTS(currentTime);
    remaining.innerHTML = toTS(video.duration - currentTime);
    progress.value = progressPercent * 10
    progress.setAttribute("data-ts", toTS(currentTime))
}

// dynamic thumbnail previews
let canvas = document.createElement("canvas")
let context = canvas.getContext('2d')
let h

function initThumbnail() {
    if (settings.player5) {
        playerData.thumbnails = []
        h = parseInt(150 / (video.videoWidth / video.videoHeight))
        canvas.width = 150;
        canvas.height = h;
        thumb.style.setProperty("--height", h + "px");
    }
}

function createThumbnail(vid) {
    if (settings.player5 && vid.readyState >= 2) {
        let index = Math.floor(vid.currentTime / 5)
        if (!playerData.thumbnails[index] && h) {
            context.fillRect(0, 0, 150, h);
            context.drawImage(vid, 0, 0, 150, h);
            playerData.thumbnails[index] = canvas.toDataURL("image/jpeg")
        }
    }
}

function finishThumbnails(file) {
    if (settings.player5 && settings.player8) {
        let thumbVid = document.createElement("video"),
            index = 0
        thumbVid.src = file.getBlobURL((err, url) => {
            thumbVid.src = url
        })

        thumbVid.addEventListener('loadeddata', () => {
            loadTime();
        })

        thumbVid.addEventListener('seeked', () => {
            createThumbnail(thumbVid);
            loadTime();
        })

        function loadTime() {
            while (playerData.thumbnails[index] && index <= Math.floor(thumbVid.duration / 5)) { // only create thumbnails that are missing
                index++
            }
            if (thumbVid.currentTime != thumbVid.duration) {
                thumbVid.currentTime = index * 5
            } else {
                URL.revokeObjectURL(thumbVid.src)
                delete thumbVid;
                thumbVid.remove()
            }
            index++
        }
    }
}

//file download
function downloadFile(file) {
    dl.removeAttribute("disabled")
    dl.onclick = async e => {
        file.getBlobURL((err, url) => {
            let a = document.createElement('a');
            a.download = file.name;
            a.href = url;
            document.body.appendChild(a);
            a.click(e);
            delete a
            a.remove();
            window.URL.revokeObjectURL(url);
        })
    }
}

// bufering spinner

let buffer;
function resetBuffer() {
    if (buffer) {
        clearTimeout(buffer)
        buffer = undefined
        buffering.classList.add('hidden')
    }
}

function isBuffering() {
    buffer = setTimeout(displayBuffer, 150)
}

function displayBuffer() {
    buffering.classList.remove('hidden')
    resetTimer()
}

// immerse timeout
let immerseTime;

player.onmousemove = resetTimer;
player.onkeypress = resetTimer;
function immersePlayer() {
    player.classList.add('immersed')
    immerseTime = undefined
}

function resetTimer() {
    if (!immerseTime) {
        clearTimeout(immerseTime);
        player.classList.remove('immersed')
        immerseTime = setTimeout(immersePlayer, parseInt(settings.player2) * 1000)
    }
}

function toTS(sec) {
    if (Number.isNaN(sec) || sec < 0) {
        return "00:00";
    }

    let hours = Math.floor(sec / 3600);
    let minutes = Math.floor((sec - (hours * 3600)) / 60);
    let seconds = Math.floor(sec - (hours * 3600) - (minutes * 60));

    if (minutes < 10) {
        minutes = `0${minutes}`;
    }

    if (seconds < 10) {
        seconds = `0${seconds}`;
    }

    if (hours > 0) {
        return `${hours}:${minutes}:${seconds}`;
    } else {
        return `${minutes}:${seconds}`;
    }
    // return new Date(sec*1000).toISOString().slice(12, -1).slice(0, -4).replace(/^0:/,"") // laggy :/
}

// play/pause button
ptoggle.addEventListener("click", btnpp);
async function playVideo() {
    try {
        await video.play();
        bpp.innerHTML = "pause";
    } catch (err) {
        bpp.innerHTML = "play_arrow";
    }
}

function btnpp() {
    if (video.paused) {
        playVideo();
    } else {
        bpp.innerHTML = "play_arrow";
        video.pause();
    }
}
// next video button
let nextCooldown
function btnnext() {
    clearTimeout(nextCooldown)
    nextCooldown = setTimeout(() => {
        let currentFile = videoFiles.filter(file => `${window.location.origin}${scope}webtorrent/${client.torrents[0].infoHash}/${encodeURI(file.path)}` == video.src)[0]
        if (videoFiles.length > 1 && videoFiles.indexOf(currentFile) < videoFiles.length - 1) {
            let fileIndex = videoFiles.indexOf(currentFile) + 1,
                nowPlaying = [playerData.nowPlaying[0], parseInt(playerData.nowPlaying[1]) + 1]
            cleanupVideo()
            buildVideo(videoFiles[fileIndex], nowPlaying)
        } else {
            if (playerData.nowPlaying[0]) {
                nyaaSearch(playerData.nowPlaying[0], parseInt(playerData.nowPlaying[1]) + 1)
            } else {
                halfmoon.initStickyAlert({
                    content: `Couldn't find anime name! Try specifying a torrent manually.`,
                    title: "Search Failed",
                    alertType: "alert-danger",
                    fillType: ""
                })
            }
        }
    }, 200)
}
// volume shit
volume.addEventListener("input", () => updateVolume());
let oldlevel;

function btnmute() {
    if (video.volume == 0) {
        updateVolume(oldlevel)
    } else {
        oldlevel = video.volume * 100
        updateVolume(0)
    }
}


function updateVolume(a) {
    let level
    if (a == null || a == NaN) {
        level = volume.value;
    } else {
        level = a;
        volume.value = a;
    }
    volume.style.setProperty("--volume-level", level + "%");
    bmute.innerHTML = (level == 0) ? "volume_off" : "volume_up";
    video.volume = level / 100
}
updateVolume(parseInt(settings.volume))


// PiP

async function btnpip() {
    if (video.readyState) {
        if (!playerData.octopusInstance) {
            video !== document.pictureInPictureElement ? await video.requestPictureInPicture() : await document.exitPictureInPicture();
        } else {
            if (document.pictureInPictureElement && !document.pictureInPictureElement.id) { //only exit if pip is the custom one, else overwrite existing pip with custom
                await document.exitPictureInPicture()
            } else {
                let canvas = document.createElement("canvas"),
                    subtitleCanvas = document.querySelector(".libassjs-canvas"),
                    canvasVideo = document.createElement("video"),
                    context = canvas.getContext("2d", { alpha: false }),
                    running = true
                canvas.width = subtitleCanvas.width
                canvas.height = subtitleCanvas.height

                function renderFrame() {
                    if (running) {
                        context.drawImage(video, 0, 0, canvas.width, canvas.height)
                        context.drawImage(subtitleCanvas, 0, 0)
                        window.requestAnimationFrame(renderFrame)
                    }
                }
                canvasVideo.srcObject = canvas.captureStream()
                canvasVideo.onloadedmetadata = async () => {
                    canvasVideo.play()
                    await canvasVideo.requestPictureInPicture().then(
                        player.classList.add("pip")
                    ).catch(e => {
                        console.warn("Failed To Burn In Subtitles " + e)
                        running = false
                        canvasVideo.remove()
                        canvas.remove()
                        player.classList.remove("pip")
                    })
                }
                canvasVideo.onleavepictureinpicture = () => {
                    running = false
                    canvasVideo.remove()
                    canvas.remove()
                    player.classList.remove("pip")
                }
                window.requestAnimationFrame(renderFrame)
            }
        }
    }
}

// theathe mode

function btntheatre() {
    pageWrapper.classList.toggle("nav-hidden")
}

// fullscreen
player.addEventListener("fullscreenchange", updateFullscreen)
ptoggle.addEventListener("dblclick", btnfull);
function btnfull() {
    document.fullscreenElement ? document.exitFullscreen() : player.requestFullscreen();
}
function updateFullscreen() {
    document.fullscreenElement ? bfull.innerHTML = "fullscreen_exit" : bfull.innerHTML = "fullscreen"
}

//seeking and skipping

function seek(a) {
    if (a == 85 && video.currentTime < 10) {
        video.currentTime = 90
    } else if (a == 85 && (video.duration - video.currentTime) < 90) {
        video.currentTime = video.duration
    } else {
        video.currentTime += a;
    }
    updateBar(video.currentTime / video.duration * 100)
}
// subtitles, generates content every single time its opened because fuck knows when the parser will find new shit
// this needs to go.... really badly
function btncap() {
    let frag = document.createDocumentFragment(),
        off = document.createElement("a")
    off.classList.add("dropdown-item", "pointer")
    playerData.selectedHeader ? off.classList.add("text-muted") : off.classList.add("text-white")
    off.innerHTML = "OFF"
    off.onclick = () => {
        renderSubs.call(null)
        playerData.selectedHeader = undefined
        btncap()
    }
    frag.appendChild(off)
    for (let track of playerData.headers) {
        if (track) {
            let template = document.createElement("a")
            template.classList.add("dropdown-item", "pointer", "text-capitalize")
            template.innerHTML = track.language || (!Object.values(playerData.headers).some(header => header.language == "eng" || header.language == "en") ? "eng" : header.type)
            if (playerData.selectedHeader == track.number) {
                template.classList.add("text-white")
            } else {
                template.classList.add("text-muted")
            }
            template.onclick = () => {
                renderSubs.call(null, track.number)
                playerData.selectedHeader = track.number
                btncap()
            }
            frag.appendChild(template)
        }
    }
    let timeOffset = document.createElement("div")
    timeOffset.classList.add("btn-group", "w-full", "pt-5")
    timeOffset.setAttribute("role", "group")
    timeOffset.innerHTML = `<button class="btn" type="button" onclick="playerData.octopusInstance.timeOffset+=1">-1s</button>
<button class="btn" type="button" onclick="playerData.octopusInstance.timeOffset-=1">+1s</button>`
    frag.appendChild(timeOffset)
    subMenu.innerHTML = '';
    subMenu.appendChild(frag)
}
//playlist

function btnpl() {
    window.location.hash = "#playlist"
}

// audio tracks

function btnaudio() {
    let frag = document.createDocumentFragment()
    for (let track of video.audioTracks) {
        let template = document.createElement("a")
        template.classList.add("dropdown-item", "pointer", "text-capitalize")
        template.innerHTML = track.language || (!Object.values(video.audioTracks).some(track => track.language == "eng" || track.language == "en") ? "eng" : track.label)
        track.enabled == true ? template.classList.add("text-white") : template.classList.add("text-muted")
        template.onclick = () => {
            selectAudio(track.id)
        }
        frag.appendChild(template)
    }

    audioTracksMenu.innerHTML = '';
    audioTracksMenu.appendChild(frag)
}
function selectAudio(id) {
    for (let track of video.audioTracks) {
        track.id == id ? track.enabled = true : track.enabled = false;
    }
    seek(-1); // stupid fix because video freezes up when chaging tracks
    btnaudio()
}
// keybinds

document.onkeydown = a => {
    if (a.key == "F5") {
        a.preventDefault();
    }
    if (document.location.hash == "#player") {
        switch (a.key) {
            case " ":
                btnpp();
                break;
            case "n":
                btnnext();
                break;
            case "m":
                btnmute();
                break;
            case "p":
                btnpip();
                break;
            case "t":
                btntheatre();
                break;
            case "c":
                btncap();
                break;
            case "f":
                btnfull();
                break;
            case "s":
                seek(85);
                break;
            case "ArrowLeft":
                seek(-parseInt(settings.player3));
                break;
            case "ArrowRight":
                seek(parseInt(settings.player3));
                break;
            case "ArrowUp":
                updateVolume(parseInt(volume.value) + 5)
                break;
            case "ArrowDown":
                updateVolume(parseInt(volume.value) - 5)
                break;
            case "Escape":
                document.location.hash = "#browse"
                break;
        }
    }
}
//media session shit

function updatePositionState() {
    if (video.duration)
        navigator.mediaSession.setPositionState({
            duration: video.duration || 0,
            playbackRate: video.playbackRate || 0,
            position: video.currentTime || 0
        });
}

if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', btnpp);
    navigator.mediaSession.setActionHandler('pause', btnpp);
    navigator.mediaSession.setActionHandler('seekbackward', () => {
        seek(-parseInt(settings.player3));
    });
    navigator.mediaSession.setActionHandler('seekforward', () => {
        seek(parseInt(settings.player3));
    });
    navigator.mediaSession.setActionHandler('nexttrack', btnnext);
}

//AL entry auto add
function checkCompletion() {
    if (!playerData.watched && video.duration - 180 < video.currentTime && playerData.nowPlaying && (playerData.nowPlaying[0].episodes || playerData.nowPlaying[0].nextAiringEpisode.episode)) {
        if (settings.other2 && !(!(playerData.nowPlaying[0].episodes || playerData.nowPlaying[0].nextAiringEpisode.episode) && playerData.nowPlaying[0].streamingEpisodes.length && parseInt(playerData.nowPlaying[1] > 12))) {
            alEntry()
        } else {
            halfmoon.initStickyAlert({
                content: `Do You Want To Mark <br><b>${playerData.nowPlaying[0].title.userPreferred}</b><br>Episode ${playerData.nowPlaying[1]} As Completed?<br>
                <button class="btn btn-sm btn-square btn-success mt-5" onclick="alEntry()" data-dismiss="alert" type="button" aria-label="Close">✓</button>
                <button class="btn btn-sm btn-square mt-5" data-dismiss="alert" type="button" aria-label="Close"><span aria-hidden="true">X</span></button>`,
                title: "Episode Complete",
                timeShown: 180000
            })
        }
        playerData.watched = true
    }
}