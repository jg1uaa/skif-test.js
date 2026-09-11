// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 SASANO Takayoshi <uaa@uaa.org.uk>

const PIN0_ON = 0x40;
const PIN0_OFF = 0x00;
const PIN_MASK = PIN0_ON;
const COUNTER_MASK = (PIN0_ON - 1);

const CMD_RATE = (x) => (0x30 + x);
const CMD_RESET = 0x2f;
const CMD_STOP = 0x2e;
const CMD_START = 0x2d;
const CMD_DEBOUNCE_COUNTER = 0x2b;
const CMD_MAX_COUNTER = 0x2a;

const Rate = 1; // 8kHz (125usec)
const Debounce = 32; // 4msec
const MaxCounter = 32; // DEFAULT_MAX_COUNTER, see "skif-arduino.h"

const TicksToMilliSeconds = (x) => (x * 0.0625 * (1 << Rate));
const TICKS_LIMIT = 10000 / TicksToMilliSeconds(1);

const delay = (msec) => new Promise(resolve => setTimeout(resolve, msec));

export class SKIFprotocol {
    queue = null;
    serialPort = null;
    reader = null;
    writer = null;
    running = false;
    PinStatus = 0;
    Ticks = 0;
    EventMask = false;

    constructor(eventQueue) {
        this.queue = eventQueue;
    }

    get_status_and_time(status) {
        const pin = status & PIN0_ON;
        const counter = status & COUNTER_MASK;

        if (!counter) {
            // if pin-off, suppress first event
            this.PinStatus = pin;
            this.EventMask = !this.PinStatus;
            this.Ticks = 0;
        } else if (this.PinStatus != pin) {
            if (!this.EventMask) {
                this.queue.push({
                    elapsed_time_ms: TicksToMilliSeconds(this.Ticks),
                    state: this.PinStatus ? 1 : 0
                });
            }
            this.EventMask = false;
            this.PinStatus = pin;
            this.Ticks = counter;
        } else {
            if (this.Ticks < TICKS_LIMIT) {
                this.Ticks += counter;
            }
        }
    }

    async loop() {
        await this.writer.write(new Uint8Array([CMD_START]));

        while (this.running) {
            const { value, done } = await this.reader.read();
            if (done) throw new Error("unexpected device close (data)");
            if (value) {
                for (let i = 0; i < value.length; i++) {
                    this.get_status_and_time(value[i]);
                }
            }
        }
    }

    async send_command(array) {
        const data = new Uint8Array(array);
        await this.writer.write(data);

        for (let i = 0; i < 10; i++) {
            const { value, done } = await this.reader.read();
            if (done) throw new Error("unexpected device close (command)");

            if (value && value.length > 0) {
                // find acknowledge from data stream
                for (let j = value.length - 1; j >= 0; j--) {
                    // acknowledge received, quit
                    if (value[j] === 0) return;
                }

                // reset retry counter
                i = 0;
            }

            await delay(10);
        }

        throw new Error("no valid response from device");
    }

    async wait_for_ack(status, signal) {
        try {
            if (signal.aborted) return;

            signal.addEventListener("abort", () => {
                if (!status.ack) this.reader.cancel();
            }, { once: true });

            while (!status.ack && !signal.aborted) {
                const { value, done } = await this.reader.read();
                if (done) throw new Error("unexpected device close (reset)");

                if (value && value.length > 0) {
                    for (let i = value.length - 1; i >= 0; i--) {
                        if (value[i] === 0) {
                            status.ack = true;
                            return;
                        }
                    }
                }
            }
        } catch (error) {
            console.error("wait_for_ack error", error);
            throw error;
        }
    }

    async wait_for_device() {
        let i;
        const status = { ack: false };
        const controller = new AbortController();

        this.wait_for_ack(status, controller.signal);

        for (i = 0; i < 10; i++) {
            if (status.ack) break;

            await this.writer.write(new Uint8Array([CMD_RESET]))
            await delay(100);
        }

        if (!status.ack) {
            controller.abort();
            this.reader.releaseLock();
            this.reader = this.serialPort.readable.getReader();
            throw new Error("device reset timeout");
        }

        await this.send_command([CMD_RATE(Rate)]);
        await this.send_command([CMD_DEBOUNCE_COUNTER, Debounce]);
        await this.send_command([CMD_MAX_COUNTER, MaxCounter]);
    }        

    async open() {
        this.PinStatus = 0;
        this.EventMask = false;
        this.running = true;

        try {
            this.serialPort = await navigator.serial.requestPort();
            await this.serialPort.open({ baudRate: 500000 });

            this.reader = this.serialPort.readable.getReader();
            this.writer = this.serialPort.writable.getWriter();

            await this.wait_for_device();
            this.loop();
        } catch (error) {
            console.error("serial port open error", error);
            this.running = false;
            throw error;
        }
    }

    async close() {
        this.running = false;

        if (this.writer) {
            this.writer.releaseLock();
            this.writer = null;
        }
        if (this.reader) {
            await this.reader.cancel();
            this.reader.releaseLock();
            this.reader = null;
        }
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
