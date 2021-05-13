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
let departments = []

let triggeredDepartment

getDepartments()

async function getDepartments() {
  let getDepartmentsResponse = await axios.get('https://console.firetext.net/api/departments/all', {})
  if (getDepartmentsResponse.data.success) {
    departments = getDepartmentsResponse.data.departments
  }
  console.log({departments})
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
var isRunning = false

function startrecording(){
  if (!isRunning) {
    isRunning = true
    navigator.getUserMedia({ audio: true, video: false }, (stream) => {
      recorder = new MediaRecorder(stream)
      if (recorder.state === 'inactive'){
        recorder.start();
  
        // currently only records for 10 seconds, refactor this to 30 seconds
        setTimeout(() => {
          stoprecording()
          isRunning = false
        }, 10000)
      }
    }, handleError)
    
    // triggers if there is an error getting the audio input
    function handleError(err) {
      alert(err)
    }
  }
}

function stoprecording(){
  recorder.ondataavailable = async function(event) {
    recorder = false
    const chunks = []
    chunks.push(event.data);
    let blob = new Blob(chunks)
    let src = URL.createObjectURL(blob)
    document.querySelector('#audioFile').src = src

    await sendAudioDispatch(blob)
    triggeredDepartment = null
  };
  if (recorder && recorder.state !== 'inactive') {
    recorder.stop();
  }
}

async function sendAudioDispatch (blob) {
  console.log({triggeredDepartment})
  let formData = new FormData()
  const dispatchInformation = {
    departmentId: triggeredDepartment._id,
  }
  formData.append('mp3File', blob)
  formData.append('dispatchInformation', JSON.stringify(dispatchInformation))
  const config = {
    params: {
      type: triggeredDepartment.type === 'All Call' ? 'allCall' : ''
    }
  }
  let postDispatchResponse = await axios.post('https://console.firetext.net/api/dispatches/voice', formData, config)
  console.log({ postDispatchResponse })
}

function getPitch() {
  pitch.getPitch(function(err, frequency) {
    // should record ensures that the startRecording function is only triggered once.
    if (frequency) {
      // step 1, get the triggered department from the first tone that matches the current frequency
      if (!triggeredDepartment) {
        // set the triggered department as a global variable so it stays as triggered while the listending for the second tone
        triggeredDepartment = _.find(departments, (department) => {
          let toneOne = department.tones[0]
          if (toneOne && !triggeredDepartment) {
            let variance1High = parseFloat(toneOne.value) + parseFloat(toneOne.variance)
            let variance1Low = parseFloat(toneOne.value) - parseFloat(toneOne.variance)
            return (frequency <= variance1High) && (frequency >= variance1Low)
          }
        })
      }

      // step 2 send the dispatch if one tone is set, otherwise test the other conditions.
      if (triggeredDepartment && recorder.state !== 'recording') {
        select('#result').html(triggeredDepartment.name);
        let toneTwo = triggeredDepartment.tones[1]
        if (toneTwo) {
          let variance2High = parseFloat(toneTwo.value) + parseFloat(toneTwo.variance)
          let variance2Low = parseFloat(toneTwo.value) - parseFloat(toneTwo.variance)
          console.log(variance2High, variance2Low, frequency)
          if ((frequency <= variance2High) && (frequency >= variance2Low)) {
            startrecording()
          }
        } else {
          // start the recording after one tone is detected
          startrecording()
        }
      } else if (triggeredDepartment && recorder.state === 'recording') {
        select('#result').html(triggeredDepartment.name);
      }
      else {
        select('#result').html(frequency.toFixed(2));
      }
    } else {
      select('#result').html('No Tone');
    }
    getPitch();
  })
}