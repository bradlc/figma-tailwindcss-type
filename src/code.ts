import mitt from 'mitt'

const emitter = mitt()

figma.ui.onmessage = ({ type, ...msg }) => {
  emitter.emit(type, msg)
}

emitter.on('READY', init)

figma.showUI(__html__, { width: 242, height: 400 })

async function init() {
  let textStyles = figma.getLocalTextStyles()
  let filteredTextStyles = textStyles.filter(
    style => (style.name.match(/\//g) || []).length === 1
  )
  let output = {}

  for (let textStyle of filteredTextStyles) {
    let [name, breakpoint] = textStyle.name.split('/')
    dset(output, [name, 'fontSize', breakpoint], `${textStyle.fontSize}px`)
    dset(
      output,
      [name, 'letterSpacing'],
      textStyle.letterSpacing.unit === 'PERCENT'
        ? `${textStyle.letterSpacing.value / 100}em`
        : `${textStyle.letterSpacing.value / textStyle.fontSize}em`
    )
    dset(
      output,
      [name, 'textTransform'],
      {
        ORIGINAL: 'none',
        UPPER: 'uppercase',
        LOWER: 'lowercase',
        TITLE: 'capitalize'
      }[textStyle.textCase]
    )

    dset(output, [name, 'fontFamily'], [textStyle.fontName.family])
    let { fontWeight, fontStyle } = parseFontStyle(textStyle.fontName.style)
    dset(output, [name, 'fontWeight'], fontWeight)
    dset(output, [name, 'fontStyle'], fontStyle)

    if (dlv(output, [name, 'crop'])) {
      continue
    }

    dset(
      output,
      [name, 'lineHeight'],
      textStyle.lineHeight.unit === 'PERCENT'
        ? textStyle.lineHeight.value / 100
        : textStyle.lineHeight.unit === 'PIXELS'
        ? textStyle.lineHeight.value / textStyle.fontSize
        : null
    )

    dset(output, [name, 'crop'], {})

    if (typeof textStyle.fontName !== 'symbol') {
      await figma.loadFontAsync(textStyle.fontName)
    }

    let textNode = figma.createText()
    textNode.textStyleId = textStyle.id
    textNode.textAutoResize = 'WIDTH_AND_HEIGHT'
    textNode.characters = 'HHHHH'
    let group = figma.group([textNode], figma.currentPage)
    let bytes = await group.exportAsync()
    group.remove()

    let response: Promise<{
      top: number
      bottom: number
      height: number
    }> = new Promise(resolve => {
      emitter.on('RESPONSE', e => {
        if (e.id === textStyle.id) {
          resolve(e)
        }
      })
    })

    figma.ui.postMessage({
      type: 'BYTES',
      id: textStyle.id,
      bytes
    })

    let { top, bottom, height } = await response
    dset(output, [name, 'crop'], {
      top,
      bottom,
      fontSize: textStyle.fontSize
    })

    if (dlv(output, [name, 'lineHeight']) === null) {
      dset(output, [name, 'lineHeight'], height / textStyle.fontSize)
    }

    dset(
      output,
      [name, 'crop', 'lineHeight'],
      dlv(output, [name, 'lineHeight'])
    )
  }

  figma.ui.postMessage({
    type: 'CONFIG',
    config: output
  })
}

function dlv(obj, key, def = undefined) {
  key = key.split ? key.split('.') : key
  for (let p = 0; p < key.length; p++) {
    obj = obj ? obj[key[p]] : undefined
  }
  return obj === undefined ? def : obj
}

function dset(obj, keys, val) {
  keys.split && (keys = keys.split('.'))
  var i = 0,
    l = keys.length,
    t = obj,
    x
  for (; i < l; ++i) {
    x = t[keys[i]]
    t = t[keys[i]] =
      i === l - 1
        ? val
        : x != null
        ? x
        : !!~keys[i + 1].indexOf('.') || !(+keys[i + 1] > -1)
        ? {}
        : []
  }
}

type FontWeight = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950
type FontStyle = 'normal' | 'italic' | 'oblique'

function parseFontStyle(
  style: string
): {
  fontWeight: FontWeight
  fontStyle: FontStyle
} {
  let parsed: { fontWeight: FontWeight; fontStyle: FontStyle } = {
    fontWeight: 400,
    fontStyle: 'normal'
  }

  if (/\b(thin|hairline)\b/i.test(style)) {
    parsed.fontWeight = 100
  } else if (/\b(extra|ultra)[ -]light\b/i.test(style)) {
    parsed.fontWeight = 200
  } else if (/\blight\b/i.test(style)) {
    parsed.fontWeight = 300
  } else if (/\bmedium\b/i.test(style)) {
    parsed.fontWeight = 500
  } else if (/\b(semi|demi)[ -]bold\b/i.test(style)) {
    parsed.fontWeight = 600
  } else if (/\b(extra|ultra)[ -]bold\b/i.test(style)) {
    parsed.fontWeight = 800
  } else if (/\bbold\b/i.test(style)) {
    parsed.fontWeight = 700
  } else if (/\b(extra|ultra)[ -]black\b/i.test(style)) {
    parsed.fontWeight = 950
  } else if (/\bblack\b/i.test(style)) {
    parsed.fontWeight = 900
  }

  if (/\bitalic\b/i.test(style)) {
    parsed.fontStyle = 'italic'
  } else if (/\boblique\b/i.test(style)) {
    parsed.fontStyle = 'oblique'
  }

  return parsed
}
