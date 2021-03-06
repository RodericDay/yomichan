/*
 * Copyright (C) 2016-2017  Alex Yatskov <alex@foosoft.net>
 * Author: Alex Yatskov <alex@foosoft.net>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */


async function apiOptionsSet(options) {
    utilBackend().onOptionsUpdated(options);
}

async function apiOptionsGet() {
    return utilBackend().options;
}

async function apiTermsFind(text) {
    const options = utilBackend().options;
    const translator = utilBackend().translator;

    const searcher = options.general.groupResults ?
        translator.findTermsGrouped.bind(translator) :
        translator.findTermsSplit.bind(translator);

    const {definitions, length} = await searcher(
        text,
        dictEnabledSet(options),
        options.scanning.alphanumeric
    );

    return {
        length,
        definitions: definitions.slice(0, options.general.maxResults)
    };
}

async function apiKanjiFind(text) {
    const options = utilBackend().options;
    const definitions = await utilBackend().translator.findKanji(text, dictEnabledSet(options));
    return definitions.slice(0, options.general.maxResults);
}

async function apiDefinitionAdd(definition, mode) {
    const options = utilBackend().options;

    if (mode !== 'kanji') {
        await audioInject(
            definition,
            options.anki.terms.fields,
            options.general.audioSource
        );
    }

    const note = await dictNoteFormat(definition, mode, options);
    return utilBackend().anki.addNote(note);
}

async function apiDefinitionsAddable(definitions, modes) {
    const states = [];

    try {
        const notes = [];
        for (const definition of definitions) {
            for (const mode of modes) {
                const note = await dictNoteFormat(definition, mode, utilBackend().options);
                notes.push(note);
            }
        }

        const results = await utilBackend().anki.canAddNotes(notes);
        for (let resultBase = 0; resultBase < results.length; resultBase += modes.length) {
            const state = {};
            for (let modeOffset = 0; modeOffset < modes.length; ++modeOffset) {
                state[modes[modeOffset]] = results[resultBase + modeOffset];
            }

            states.push(state);
        }
    } catch (e) {
        // NOP
    }

    return states;
}

async function apiNoteView(noteId) {
    return utilBackend().anki.guiBrowse(`nid:${noteId}`);
}

async function apiTemplateRender(template, data, dynamic) {
    if (dynamic) {
        return handlebarsRenderDynamic(template, data);
    } else {
        return handlebarsRenderStatic(template, data);
    }
}

async function apiCommandExec(command) {
    const handlers = {
        search: () => {
            chrome.tabs.create({url: chrome.extension.getURL('/bg/search.html')});
        },

        help: () => {
            chrome.tabs.create({url: 'https://foosoft.net/projects/yomichan/'});
        },

        options: () => {
            chrome.runtime.openOptionsPage();
        },

        toggle: async () => {
            const options = utilBackend().options;
            options.general.enable = !options.general.enable;
            await optionsSave(options);
            await apiOptionsSet(options);
        }
    };

    const handler = handlers[command];
    if (handler) {
        handler();
    }
}

async function apiAudioGetUrl(definition, source) {
    return audioBuildUrl(definition, source);
}
