# Gesture-Controlled Robot Car 🤖✋

Drive a robot car with nothing but your hand. A webcam tracks your fingers
with MediaPipe, and each gesture steers the car wirelessly over Bluetooth —
no remote, no joystick.

> 🎥 **Try it in your browser** — no hardware needed:
> a live demo runs the same gesture logic on your webcam and drives an
> animated car on screen.
> <https://pavan512002.github.io/portfolio/projects/gesture-car/>

## How it works

```
fingers up → webcam → MediaPipe → Python → USB serial → Arduino (sender)
    → Bluetooth (HC-05) → Arduino (car) → motors
```

## Gesture map

| Fingers | Command  |
|---------|----------|
| 1       | Forward  |
| 2       | Backward |
| 3       | Left     |
| 4       | Right    |
| 0 / 5   | Stop     |

## Files

| File            | What it does                                                        |
|-----------------|---------------------------------------------------------------------|
| `hand_module.py`| `HandDetector` class: MediaPipe hand landmarks + finger counting    |
| `final.py`      | Main loop: webcam → finger count → sends digit over serial (38400)  |
| `sender.ino`    | Arduino relay: forwards serial characters to the HC-05 Bluetooth module |
| `car.ino`       | Car Arduino: maps the received digit to motor directions (pins 8–11) |

## Hardware

- 2× Arduino (one as sender, one on the car)
- HC-05 Bluetooth module
- Motor driver (L298N-style) + DC motors / robot chassis
- Webcam + a computer running the Python script

## Run it

```bash
pip install opencv-python mediapipe pyserial
python final.py
# select your Arduino's COM port when prompted, then show your hand ✋
```
