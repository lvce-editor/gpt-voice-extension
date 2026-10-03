import type { ITranscript } from '../CreateInstance/CreateInstance.ts'
import * as ClassNames from '../ClassNames/ClassNames.ts'
import * as MergeClassNames from '../MergeClassNames/MergeClassNames.ts'

const transcriptAiClassName = MergeClassNames.mergeClassNames(
  ClassNames.GptVoiceTranscriptItem,
  ClassNames.GptVoiceTranscriptItemAi,
)

const transcriptUserClassName = MergeClassNames.mergeClassNames(
  ClassNames.GptVoiceTranscriptItem,
  ClassNames.GptVoiceTranscriptItemUser,
)

export const getTranscriptClassName = (item: ITranscript): string => {
  if (item.type === 'ai') {
    return transcriptAiClassName
  }
  return transcriptUserClassName
}
