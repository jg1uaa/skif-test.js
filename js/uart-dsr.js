// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 SASANO Takayoshi <uaa@uaa.org.uk>

export class DSRSignal {
    lastState = 0;
    lastTime = 0;
    isFirstPress = true;
    queue = null;
    serialPort = null;
    running = false;

    constructor(eventQueue) {
        this.queue = eventQueue;
    }

    async loop() {
        while (this.running) {
            try {
                const signals = await this.serialPort.getSignals();
                const state = Number(signals.dataSetReady);

                if (state !== this.lastState) {
                    const currentTime = performance.now();

                    if (!this.isFirstPress) {
                        this.queue.push({
                            state: this.lastState,
                            elapsed_time_ms: currentTime - this.lastTime
                        });
                    }
                    this.lastState = state;
                    this.lastTime = currentTime;
                    this.isFirstPress = false;
                }
            } catch (error) {
                console.error("serial port access error", error);
                break;
            }

            // wait for event loop
            await new Promise(resolve => queueMicrotask(resolve));
        }
    }

    async open() {
        this.isFirstPress = true;
        this.running = true;

        try {
            this.serialPort = await navigator.serial.requestPort();
            await this.serialPort.open({ baudRate: 9600 });

            const signals = await this.serialPort.getSignals();
            this.lastState = Number(signals.dataSetReady);
            this.lastTime = performance.now();

            this.loop();
        } catch (error) {
            console.error("serial port open error", error);
            this.running = false;
            throw error;
        }
    }

    async close() {
        this.running = false;

        if (this.serialPort) {
            try {
                await this.serialPort.close();
            } catch (error) {
                console.error("serial port close error", error);
            }
            this.serialPort = null;
        }
    }
}
