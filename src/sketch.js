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
let triggeredDepartments = []

getDepartments()

async function getDepartments() {
  let lsDepartments = localStorage.getItem('departments')

  if (lsDepartments) {
    departments = JSON.parse(lsDepartments)
    console.log(departments)
  }
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
  if (!isRunning && triggeredDepartment) {
    console.log('recording')
    isRunning = true
    navigator.getUserMedia({ audio: true, video: false }, (stream) => {
      recorder = new MediaRecorder(stream)
      if (recorder.state === 'inactive'){
        recorder.start();
  
        // currently only records for 10 seconds, refactor this to 30 seconds
        setTimeout(() => {
          stoprecording()
          isRunning = false
        }, 30000)
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
    triggeredDepartments = []
    URL.revokeObjectURL(src)
  };
  if (recorder && recorder.state !== 'inactive') {
    recorder.stop();
  }
}

async function sendAudioDispatch (blob) {
  let formData = new FormData()
  formData.append('mp3File', blob)
  formData.append('dispatchInformation', JSON.stringify({
    departmentId: triggeredDepartment._id,
  }))

  try {
    let postDispatchResponse = await axios.post('https://console.firetext.net/api/dispatches/voice', formData)
    console.log({ postDispatchResponse })
  } catch(err) {
    console.log(err)
  }
}

function getPitch() {
  pitch.getPitch(function(err, frequency) {
    // should record ensures that the startRecording function is only triggered once.
    if (frequency && frequency > 288 && !triggeredDepartment) {
      console.log(frequency)
      // step 1, get the triggered department from the first tone that matches the current frequency
      if (triggeredDepartments.length === 0) {
        // set the triggered department as a global variable so it stays as triggered while the listending for the second tone
        triggeredDepartments = _.filter(departments, (department) => {
          let toneOne = department.tones[0]
          if (toneOne && !triggeredDepartment) {
            let variance1High = toneOne.value + toneOne.variance
            let variance1Low = toneOne.value - toneOne.variance
            return (frequency <= variance1High) && (frequency >= variance1Low)
          }
        })
      }

      // step 2 send the dispatch if one tone is set, otherwise test the other conditions.
      if (triggeredDepartments.length > 0 && recorder.state !== 'recording') {
        triggeredDepartments.forEach(triggeredDept => {
          let toneTwo = triggeredDept.tones[1]
          if (toneTwo) {
            let variance2High = toneTwo.value + toneTwo.variance
            let variance2Low = toneTwo.value - toneTwo.variance
            if ((frequency <= variance2High) && (frequency >= variance2Low)) {
              triggeredDepartment = triggeredDept
              select('#result').html(triggeredDepartment.name);
              startrecording()
            }
          } else {
            // start the recording after one tone is detected
            triggeredDepartment = triggeredDepartments.find((dept, index) => {
              return index === 0
            })
            select('#result').html(triggeredDepartment.name);
            startrecording()
          }
        })
      }
      else {
        
      }
    } else {
      select('#result').html('No Department Tones');
    }
    setTimeout(() => {
      getPitch();
    }, 200)
  })
}