// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 SASANO Takayoshi <uaa@uaa.org.uk>

import { EventQueue } from "./queue.js";
import { HIDDevice } from "./hiddevice.js";
import { DSRSignal } from "./uart-dsr.js";
import { SKIFprotocol } from "./uart-skif.js";
import { table_en, table_jp, Decoder } from "./table.js";

let basetime_ms = 100;

const queue = new EventQueue();
let device = null;
let decoder = null;

const DIT_TOO_SHORT = "X";
const DIT_GOOD = ".";
const DIT_OR_DAH = "?";
const DAH_GOOD = "-";
const DAH_TOO_LONG = "=";

const SPACE_TOO_SHORT = "x";
const SPACE_GOOD = "_";
const SPACE_TOO_LONG = "!";
const CHAR_SPACE = "~";
const WORD_SPACE = "#";

const isDecodeFinish = (c) => ((c == CHAR_SPACE || c == WORD_SPACE))

let decode_buffer = "";
let display = "";
let lang = "";

function print(str) {
    const output = document.getElementById("output");

    if (!output) return;

    if (str == null) {
        output.textContent = "";
    } else {
        output.textContent += str;
    }

    window.scrollTo(0, document.body.scrollHeight);
}

function decode_display(c)
{
    if (isDecodeFinish(c)) {
        print(decoder.decode(decode_buffer));
    }

    if (c == WORD_SPACE) {
        print((lang == "JP") ? "　" : " ");
    }
}

function simple_display(c)
{
    if (c != SPACE_GOOD && !isDecodeFinish(c)) {
        print(c);
    }

    if (isDecodeFinish(c)) {
        print(" [" + decoder.decode(decode_buffer) + "] ");
    }

    if (c == WORD_SPACE) {
        print("\n");
    }
}

function verbose_display(c, msec)
{
    print(c + " " + String(msec) + "\n");

    if (isDecodeFinish(c)) {
        print("* " + decode_buffer + " [" + decoder.decode(decode_buffer) + "]\n\n");
    }
}

function push_status(state, msec) {
    let c = "";

    if(state) {
        if (msec < basetime_ms * 0.5) c = DIT_TOO_SHORT;
        else if (msec < basetime_ms * 1.5) c = DIT_GOOD;
        else if (msec < basetime_ms * 2) c = DIT_OR_DAH;
        else if (msec < basetime_ms * 6) c = DAH_GOOD;
        else c = DAH_TOO_LONG;
    } else {
        if (msec < basetime_ms * 0.5) c = SPACE_TOO_SHORT;
        else if (msec < basetime_ms * 1.5) c = SPACE_GOOD;
        else if (msec < basetime_ms * 2) c = SPACE_TOO_LONG;
        else if (msec < basetime_ms * 4) c = CHAR_SPACE;
        else c = WORD_SPACE;
    }

    if (c != SPACE_GOOD && c != CHAR_SPACE && c != WORD_SPACE) {
        decode_buffer += c;
    }

    switch (display) {
    case "decodeonly":
        decode_display(c);
        break;
    case "verbose":
        verbose_display(c, msec);
        break;
    default:
        simple_display(c);
        break;
    }

    if (c == CHAR_SPACE || c == WORD_SPACE) {
        decode_buffer = "";
    }
}

function startTimer(runningTimer, msec) {
    if (runningTimer) {
        clearTimeout(runningTimer)
    }

    return setTimeout(function() {
        queue.push({ isTimeout: true });
    }, msec);
}

async function do_main() {
    let last_sw = -1;
    let runningTimer = null;
    let firstEvent = true;

    while (true) {
        const event = await queue.pop();

        if (event.isTimeout) {
            push_status(!last_sw, basetime_ms * 10);
            last_sw = !last_sw;
            continue;
        }

        if (event.state != last_sw) {
            // clear "Ready" status
            if (firstEvent) {
                print(null);
                firstEvent = false;
            }

            push_status(event.state, event.elapsed_time_ms);
            last_sw = event.state;

            // invoke timer (for detect timeout)
            runningTimer = startTimer(runningTimer, basetime_ms * 10);
        }

    }
}

async function main() {
    const startBtn = document.getElementById("start-btn");
    if (startBtn) startBtn.disabled = true;
    
    const wpm_ui = document.getElementById("wpm");
    const wpm = wpm_ui ? parseInt(wpm_ui.value, 10) : 12;

    basetime_ms = 1200 / wpm;

    lang = document.querySelector('input[name="lang"]:checked').value;
    display = document.querySelector('input[name="display"]:checked').value;
    const iface = document.querySelector('input[name="interface"]:checked').value;
    
    decoder = new Decoder((lang == "JP") ? table_jp : table_en);
    if (iface == "dsr") device = new DSRSignal(queue);
    if (iface == "skif") device = new SKIFprotocol(queue);
    else device = new HIDDevice(queue);

    try {
        await device.open();
        print("ready.\n\n");
        await do_main();
    } catch (error) {
        print("not ready. (reload to retry)\n\n");
    }
}

function save()
{
    // create filename, log content
    const date = new Date();
    const log_date = new Intl.DateTimeFormat('ja-JP', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
    }).format(date).replace(/\D/g, '');
    const log_name = `skif_log_${log_date}.txt`;
    const log_content = output.textContent;

    // avoid empty log
    if (!log_content) return;

    const blob = new Blob([log_content], { type: 'text/plain' });

    // save it
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = log_name;
    a.click();

    URL.revokeObjectURL(a.href);
}

window.addEventListener("DOMContentLoaded", () => {
    const startBtn = document.getElementById("start-btn");
    startBtn.addEventListener("click", async () => await main());

    const saveBtn = document.getElementById("save-btn");
    saveBtn.addEventListener("click", save);
});
