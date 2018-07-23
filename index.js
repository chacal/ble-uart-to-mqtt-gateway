const mqtt = require('mqtt')
const SerialPort = require('serialport')
const Readline = SerialPort.parsers.Readline
const Bacon = require('baconjs')

const UART_DEVICE = process.env.UART_DEVICE || '/dev/ttyAMA0'
const MQTT_BROKER = process.env.MQTT_BROKER ? process.env.MQTT_BROKER : 'mqtt://localhost'
const MQTT_USERNAME = process.env.MQTT_USERNAME || undefined
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || undefined
const UART_GW_ID = process.env.UART_GW_ID || 0

const BAUD_RATE = 230400

startMqttClient(MQTT_BROKER, MQTT_USERNAME, MQTT_PASSWORD)
  .combine(openSerialPort(UART_DEVICE), (mqtt, port) => ({mqtt, port}))
  .onValue(({mqtt, port}) => {
    Bacon.fromEvent(port, 'data')
      .onValue(data => publishToMqtt(mqtt, data))
  })

function publishToMqtt(mqttClient, data) {
  mqttClient.publish(`/bt-sensor-gw/${UART_GW_ID}/value`, data)
}

function openSerialPort(device) {
  const port = new SerialPort(device, {baudRate: BAUD_RATE, platformOptions: {vmin: 255, vtime: 0}})
  const parser = new Readline()
  port.pipe(parser)
  return Bacon.fromEvent(port, 'open').map(parser)
    .merge(Bacon.fromEvent(port, 'error', e => new Bacon.Error(e)))
}


function startMqttClient(brokerUrl, username, password) {
  const client = mqtt.connect(brokerUrl, { queueQoSZero : false, username, password })
  client.on('connect', () => console.log('Connected to MQTT server'))
  client.on('offline', () => console.log('Disconnected from MQTT server'))
  client.on('error', e => console.log('MQTT client error', e))

  return Bacon.fromEvent(client, 'connect').first()
    .map(() => client)
}
