import type { FundedVoiceErrorDetails } from 'voice-shared'
import {
  text,
  type VirtualDomNode,
  VirtualDomElements,
} from '@lvce-editor/virtual-dom-worker'
import * as ClassNames from '../ClassNames/ClassNames.ts'
import * as GptVoiceStrings from '../GptVoiceStrings/GptVoiceStrings.ts'
import { mergeClassNames } from '../MergeClassNames/MergeClassNames.ts'

const pricingUrl = 'https://lvce-editor.dev/pricing'

const containerNode: VirtualDomNode = {
  childCount: 1,
  className: mergeClassNames(ClassNames.GptVoice, ClassNames.GptVoiceSetup),
  type: VirtualDomElements.Div,
}

const contentNode: VirtualDomNode = {
  childCount: 5,
  className: ClassNames.GptVoiceAllowance,
  type: VirtualDomElements.Div,
}

const illustrationNode: VirtualDomNode = {
  childCount: 0,
  className: ClassNames.GptVoiceAllowanceIllustration,
  type: VirtualDomElements.Div,
}

const titleNode: VirtualDomNode = {
  childCount: 1,
  className: ClassNames.GptVoiceAllowanceTitle,
  type: VirtualDomElements.Div,
}

const descriptionNode: VirtualDomNode = {
  childCount: 1,
  className: ClassNames.GptVoiceAllowanceDescription,
  type: VirtualDomElements.Div,
}

const detailsNode: VirtualDomNode = {
  childCount: 4,
  className: ClassNames.GptVoiceAllowanceDetails,
  type: VirtualDomElements.Div,
}

const detailsTitleNode: VirtualDomNode = {
  childCount: 1,
  className: ClassNames.GptVoiceAllowanceDetailsTitle,
  type: VirtualDomElements.Div,
}

const pricingLinkNode: VirtualDomNode = {
  childCount: 1,
  className: mergeClassNames(
    ClassNames.GptVoiceButton,
    ClassNames.GptVoiceAllowancePricingLink,
  ),
  href: pricingUrl,
  rel: 'noopener noreferrer',
  target: '_blank',
  type: VirtualDomElements.A,
}

const detailNode: VirtualDomNode = {
  childCount: 2,
  className: ClassNames.GptVoiceAllowanceDetail,
  type: VirtualDomElements.Div,
}

const detailLabelNode: VirtualDomNode = {
  childCount: 1,
  className: ClassNames.GptVoiceAllowanceDetailLabel,
  type: VirtualDomElements.Div,
}

const detailValueNode: VirtualDomNode = {
  childCount: 1,
  className: ClassNames.GptVoiceAllowanceDetailValue,
  type: VirtualDomElements.Div,
}

const renderDetail = (
  label: string,
  value: string,
): readonly VirtualDomNode[] => [
  detailNode,
  detailLabelNode,
  text(label),
  detailValueNode,
  text(value),
]

export const renderAllowanceExceeded = (
  details: FundedVoiceErrorDetails | undefined,
): readonly VirtualDomNode[] => [
  containerNode,
  contentNode,
  illustrationNode,
  titleNode,
  text(GptVoiceStrings.monthlyAllowanceExceeded()),
  descriptionNode,
  text(GptVoiceStrings.monthlyAllowanceDescription()),
  detailsNode,
  detailsTitleNode,
  text(GptVoiceStrings.errorDetails()),
  ...renderDetail(
    GptVoiceStrings.httpStatus(),
    details?.statusCode ? String(details.statusCode) : 'Not provided',
  ),
  ...renderDetail(
    GptVoiceStrings.errorCode(),
    details?.code || 'E_LVCE_USAGE_EXCEEDED',
  ),
  ...renderDetail(
    GptVoiceStrings.errorDescription(),
    GptVoiceStrings.monthlyAllowanceErrorDescription(),
  ),
  pricingLinkNode,
  text(GptVoiceStrings.viewPlansAndPricing()),
]
