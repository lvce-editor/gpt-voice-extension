import type { ITranscript } from '../CreateInstance/CreateInstance.ts'
import * as ClassNames from '../ClassNames/ClassNames.ts'
import * as MergeClassNames from '../MergeClassNames/MergeClassNames.ts'

export const getTranscriptClassName = (item: ITranscript): string => {
  if (item.type === 'ai') {
    return MergeClassNames.mergeClassNames(
      ClassNames.GptVoiceTranscriptItem,
      ClassNames.GptVoiceTranscriptItemAi,
    )
  }
  return MergeClassNames.mergeClassNames(
    ClassNames.GptVoiceTranscriptItem,
    ClassNames.GptVoiceTranscriptItemUser,
  )
}
