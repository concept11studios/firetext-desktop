// Copyright (c) 2019 ml5
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

/* ===
ml5 Example
Basic Pitch Detection
=== */

/*** FLOW */

// 1. Detect department by tone
// 2. Create audioDispatch
// 3. get dispatchId of newly created dispatch
// 3. Start Recording
// 4. sendChunksToDynamoDb
// 5. after 30 seconds, stop recording
// 6. patch audioBlob to dispatch



const axios = require('axios')
const _ = require('underscore')

const model_url =
  './model'

/*** INITIALIZATION */

// VARIABLES
let departments = []
let audioContext
let mic
let pitch

let triggeredDepartment
let triggeredDepartments = []

let recorder = false
let isRunning = false

let currentDispatchId 

// life cycle method from p5.js
function setup() { 
  audioContext = new AudioContext()
  mic = new p5.AudioIn()
  mic.start(startPitch)
  
  function startPitch() {
    pitch = ml5.pitchDetection(model_url, audioContext, mic.stream, modelLoaded)
    function modelLoaded() {
      select('#status').html('Model Loaded');
      getPitch();
    }
  }
}

// MAIN CODE
getDepartments()

function getPitch() {
  console.log('GET PITCH CALLED')
  pitch.getPitch(function(err, frequency) {
    // should record ensures that the start Recording function is only triggered once.
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
              startRecording()
            }
          } else {
            // start the recording after one tone is detected
            triggeredDepartment = triggeredDepartments.find((dept, index) => {
              return index === 0
            })
            select('#result').html(triggeredDepartment.name)
            startRecording()
          }
        })
      }
      else {
        
      }
    } else {
      select('#result').html('No Department Tones')
    }
    setInterval(() => {
      if (!isRunning) getPitch()
    }, 200)
  })
  console.log({triggeredDepartments, triggeredDepartment})
}

async function startRecording(){
  if (!isRunning && triggeredDepartment) {
    currentDispatchId = await createAudioDispatch()
    try {
      if (currentDispatchId) {
        console.log(`recording disptach with id: ${currentDispatchId}`)
        isRunning = true
        navigator.getUserMedia({ audio: true, video: false }, (stream) => handleRecording(stream, currentDispatchId), handleError)
      }
      else {
        console.log('failed to create dispatch')
      }
    } catch (error) {
      console.log({'getUserMedia error': error})
      return
    }
  }
}

function handleRecording (stream, dispatchId) {
  recorder = new MediaRecorder(stream)
  
  let chunks = []
  let partialChunks = []
  let chunkNumber = 0
  
  if (recorder.state === 'inactive') {
    // get media chunks after every second 
    recorder.start(1000)
    
    // stop recorder after 30 secs
    setTimeout(() => {
      stopRecording()
    }, 30000)

    // handle chunks of recorded stream
    recorder.ondataavailable = async function (ev) {
      chunks.push(ev.data)

      let blob = ev.data
      let base64 = await blobToBase64(blob)
      partialChunks.push(base64)

      if (partialChunks.length >= 5) {
        let chunksPack = partialChunks.slice(0, 5)
        partialChunks = partialChunks.slice(5)
                  
        let item = {
          dispatchId,
          "chunkNumber": chunkNumber++,
          "chunks": chunksPack
        }
        
        sendChunksToDynamoDB(item)
      }
    }

    // handle end of recorded stream
    recorder.onstop = async (ev) => {
      //send remaining chunks to dynamoDB
      if (ev.data) {
        let partialBlob = ev.data
        let base64 = await blobToBase64(partialBlob)
        partialChunks.push(base64)
      }

      let chunksPack = partialChunks
      let item = {
        dispatchId,
        "chunkNumber": chunkNumber,
        "chunks": chunksPack
      }
      sendChunksToDynamoDB(item)

      //patch audio to dispatch
      let blob = new Blob(chunks)
      let src = URL.createObjectURL(blob)
      document.querySelector('#audioFile').src = src
      await patchAudioFileToDispatch(dispatchId, blob)
      
      //cleanup
      triggeredDepartment = null
      triggeredDepartments = []
      currentDispatchId = null
      partialChunks = []
      chunkNumber = 0
      recorder = false
      URL.revokeObjectURL(src)
      chunks = []
      isRunning = false
    }
  }

}

function stopRecording() {
  if (recorder && recorder.state !== 'inactive') {
    recorder.stop()
  }
}

// HELPERS

async function getDepartments() {
  let lsDepartments = localStorage.getItem('departments')

  if (lsDepartments) {
    departments = JSON.parse(lsDepartments)
    console.log(departments)
  }
}

async function createAudioDispatch () {
  try {
    let postDispatchResponse = await axios.post('https://console.firetext.net/api/dispatches/voice', { departmentId: triggeredDepartment._id })
    console.log({ postDispatchResponse })
    return postDispatchResponse?.data?.dispatch?._id
  } catch(err) {
    console.log(err)
    return false
  }
}

async function patchAudioFileToDispatch (dispatchId, blob) {
  let formData = new FormData()
  formData.append('mp3File', blob)

  try {
    let audioFilePatchResponse = await axios.patch(`https://console.firetext.net/api/dispatches/voice/${dispatchId}`, formData)
    console.log({ audioFilePatchResponse })
  } catch(err) {
    console.log(err)
  }
}

async function sendChunksToDynamoDB (item) {
  let url = "https://seebv1ux07.execute-api.us-east-1.amazonaws.com/dev"

  let xhr = new XMLHttpRequest()
  xhr.open("POST", url)

  xhr.setRequestHeader("Accept", "application/json")
  xhr.setRequestHeader("Content-Type", "application/json")

  xhr.onreadystatechange = function () {
  if (xhr.readyState === 4) {
    console.log(xhr.status)
    console.log(xhr.responseText)
  }}


  xhr.send(JSON.stringify(item))
  console.log("sending data to api")

}

async function blobToBase64 (blob) {
    let reader = new FileReader()
    return new Promise((resolve, reject) => {
        reader.readAsDataURL(blob)
        reader.onloadend = function () {
            let base64String = reader.result
            console.log({base64StringF: base64String})
            resolve (base64String)
        }
    })
    
}

function handleError(err) {
  alert(err)
}

