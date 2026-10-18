// Registry: mode id → exercise factory (Mode 1 flashcard lives in components/flashcard.js)
import * as listening from './listening.js';
import * as cloze from './cloze.js';
import * as writing from './writing.js';
import * as multipleChoice from './multiple-choice.js';
import * as clozePassage from './cloze-passage.js';
import * as matching from './matching.js';
import * as sentenceBuilder from './sentence-builder.js';
import * as toneDrill from './tone-drill.js';
import * as radicalAssembly from './radical-assembly.js';
import * as dictation from './dictation.js';
import * as translation from './translation.js';
import * as speaking from './speaking.js';
import * as collocation from './collocation.js';
import * as speedRound from './speed-round.js';

export const EXERCISES = Object.freeze({
  listening,
  cloze,
  writing,
  multiple_choice: multipleChoice,
  cloze_passage: clozePassage,
  matching,
  sentence_builder: sentenceBuilder,
  tone_drill: toneDrill,
  radical_assembly: radicalAssembly,
  dictation,
  translation,
  speaking,
  collocation,
  speed_round: speedRound,
});

export function createExercise(mode, ctx) {
  const factory = EXERCISES[mode];
  if (!factory) throw new Error(`Unknown exercise mode: ${mode}`);
  return factory.create({ ...ctx, mode });
}
