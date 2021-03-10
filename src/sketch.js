// Copyright (c) 2019 ml5
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

/* ===
ml5 Example
Basic Pitch Detection
=== */

const axios = require('axios')
const { v4: uuidv4 } = require('uuid');

const model_url =
  'https://cdn.jsdelivr.net/gh/ml5js/ml5-data-and-models/models/pitch-detection/crepe/';

let audioContext;
let mic;
let pitch;
let shouldRecord = true;


function setup() {
  audioContext = new AudioContext();
  mic = new p5.AudioIn();
  mic.start(startPitch);
}

function handleError() {
  alert('could not connect computer audio')
}

function startPitch() {
  pitch = ml5.pitchDetection(model_url, audioContext, mic.stream, modelLoaded);
}

function modelLoaded() {
  select('#status').html('Model Loaded');
  getPitch();
}

var recorder=false;

function startrecording(){
  shouldRecord = false
  navigator.getUserMedia({ audio: true, video: false }, (stream) => {
    recorder = new MediaRecorder(stream)
    recorder.start();

    setTimeout(() => {
      stoprecording()
    }, 10000)

  }, handleError)
  
  // triggers if there is an error getting the audio input
  function handleError(err) {
    alert(err)
  }
}

function stoprecording(){
  recorder.ondataavailable = function(event) {
    recorder = false
    const chunks = []
    chunks.push(event.data);
    let blob = new Blob(chunks)
    let src = URL.createObjectURL(blob)
    document.querySelector('#audioFile').src = src

    sendAudioDispatch(blob)
  };
  recorder.stop();
  shouldRecord = true
}

async function sendAudioDispatch (blob) {
  console.log({blob})
  let formData = new FormData()
  const dispatchInformation = {
    departmentId: '5ffbbcc3a637ac4c537455c2',
  }
  formData.append('mp3File', blob)
  formData.append('dispatchInformation', JSON.stringify(dispatchInformation))
  let postDispatchResponse = await axios.post('http://54.163.135.65/api/dispatches', formData, {})
  console.log({ postDispatchResponse })
}

function getPitch() {
  pitch.getPitch(function(err, frequency) {
    // should record ensures that the startRecording function is only triggered once.
    if (frequency) {
        if (frequency >= 585 && frequency <= 589) {
            select('#result').html('Concept 11 FD');
            if (shouldRecord) {
              startrecording()
            }
        } else if (frequency >= 1155 && frequency <= 1162) {
            select('#result').html('FireTEXT FD');
            if (shouldRecord) {
              startrecording()
            }
        } else {
            select('#result').html(Math.round(frequency));
        }
    } else {
      select('#result').html('');
    }
    getPitch();
  })
}