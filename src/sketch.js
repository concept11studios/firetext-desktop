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
const _ = require('underscore')

const model_url =
  './model';

let audioContext;
let mic;
let pitch;
let shouldRecord = true;
let departments = []
getDepartments()

async function getDepartments() {
  let getDepartmentsResponse = await axios.get('https://console.firetext.net/api/departments/all', {})
  if (getDepartmentsResponse.data.success) {
    departments = getDepartmentsResponse.data.departments
  }
  console.log(departments)
}

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
  let postDispatchResponse = await axios.post('https://console.firetext.net/api/dispatches/voice', formData, {})
  console.log({ postDispatchResponse })
}

function getPitch() {
  pitch.getPitch(function(err, frequency) {
    // should record ensures that the startRecording function is only triggered once.
    if (frequency) {
      // step 1, get the triggered department from the first tone that matches the current frequency
      let triggeredDepartment = _.find(departments, (department) => {
        let toneOne = department.tones[0]
        if (toneOne) {
          let varianceHigh = toneOne.value + toneOne.variance
          let varianceLow = toneOne.value - toneOne.variance
          return (frequency <= varianceHigh) && (frequency >= varianceLow)
        }
      })
      // step 2 send the dispatch if one tone is set, otherwise test the other conditions.
      if (triggeredDepartment) {
        select('#result').html(triggeredDepartment.name);
        let toneTwo = triggeredDepartment.tones[1]
        if (toneTwo) {
          let varianceHigh = toneTwo.value + toneTwo.variance
          let varianceLow = toneTwo.value - toneTwo.variance
          if ((frequency <= varianceHigh) && (frequency >= varianceLow)) {
            startrecording()
          }
        } else {
          startrecording()
        }
      } else {
        select('#result').html(frequency);
      }
    } else {
      select('#result').html('');
    }
    getPitch();
  })
}