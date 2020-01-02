import React, { useEffect, useState } from 'react'
import * as ReactDOM from 'react-dom'
import './ui.css'

async function decode(canvas, ctx, bytes) {
  const url = URL.createObjectURL(new Blob([bytes]))
  const image = await new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject()
    img.src = url
  })
  // @ts-ignore
  let width = image.width
  // @ts-ignore
  let height = image.height
  canvas.width = width
  canvas.height = height
  ctx.drawImage(image, 0, 0)
  const imageData = ctx.getImageData(0, 0, width, height)
  return [width, height, imageData, canvas]
}

function downloadFile(data, fileName, type = 'text/plain') {
  const a = document.createElement('a')
  a.style.display = 'none'
  document.body.appendChild(a)
  a.href = window.URL.createObjectURL(new Blob([data], { type }))
  a.setAttribute('download', fileName)
  a.click()

  window.URL.revokeObjectURL(a.href)
  document.body.removeChild(a)
}

function App() {
  let [config, setConfig] = useState()
  let [breakpoints, setBreakpoints] = useState({})
  let [fonts, setFonts] = useState({})
  let [selectedStyles, setSelectedStyles] = useState([])

  useEffect(() => {
    window.onmessage = async ({ data: { pluginMessage: msg } }) => {
      if (msg.type === 'BYTES') {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        const imageData = await decode(canvas, ctx, msg.bytes)
        const pixels = imageData[2].data
        let top = null
        let bottom = null

        for (let y = 0; y < imageData[1]; y++) {
          for (let x = 0; x < imageData[0]; x++) {
            let n = (x + y * imageData[0]) * 4
            let alpha = pixels[n + 3]
            if (alpha > 0) {
              top = y

              ctx.strokeStyle = 'red'
              ctx.beginPath()
              ctx.moveTo(0, y)
              ctx.lineTo(canvas.width, y)
              ctx.stroke()
              break
            }
          }
          if (top !== null) break
        }

        for (let y = canvas.height - 1; y >= 0; y--) {
          for (let x = canvas.width; x >= 0; x--) {
            let n = (x + y * imageData[0]) * 4
            let alpha = pixels[n + 3]
            if (alpha > 0) {
              bottom = canvas.height - y

              ctx.strokeStyle = 'red'
              ctx.beginPath()
              ctx.moveTo(0, y)
              ctx.lineTo(canvas.width, y)
              ctx.stroke()
              break
            }
          }
          if (bottom !== null) break
        }

        // document.body.appendChild(canvas)

        parent.postMessage(
          {
            pluginMessage: {
              type: 'RESPONSE',
              id: msg.id,
              top,
              bottom,
              height: canvas.height
            }
          },
          '*'
        )
      } else if (msg.type === 'CONFIG') {
        let bps = {}
        Object.keys(msg.config).forEach(name => {
          Object.keys(msg.config[name].fontSize).forEach(bp => {
            bps[bp] = ''
          })
        })

        let fonts = {}
        Object.keys(msg.config).forEach(name => {
          fonts[msg.config[name].fontFamily[0]] = ''
        })

        setConfig(msg.config)
        setBreakpoints(bps)
        setFonts(fonts)
        setSelectedStyles(Object.keys(msg.config))
      }
    }

    parent.postMessage(
      {
        pluginMessage: {
          type: 'READY'
        }
      },
      '*'
    )
  }, [])

  function exportJson() {
    let exportedConfig = {}
    Object.keys(config).forEach(key => {
      if (selectedStyles.indexOf(key) === -1) return
      let style = JSON.parse(JSON.stringify(config[key]))
      style.fontFamily.push(...fonts[style.fontFamily[0]].split(/\s*,\s*/))
      style.fontSize = Object.keys(style.fontSize).reduce((acc, curr) => {
        return { ...acc, [`${breakpoints[curr]}px`]: style.fontSize[curr] }
      }, {})
      exportedConfig[toKebabCase(key)] = style
    })
    downloadFile(
      JSON.stringify(exportedConfig, null, 2),
      'type.json',
      'application/json'
    )
  }

  return config ? (
    <main className="min-h-full flex flex-col">
      <section
        style={{ boxShadow: '0 1px 0 0 rgba(0, 0, 0, .1)', padding: '8px 0' }}
      >
        <h2
          className="font-semibold flex items-center"
          style={{
            padding: '0 16px',
            height: 32
          }}
        >
          Breakpoints
        </h2>

        <ul style={{ padding: '0 8px' }}>
          {Object.keys(breakpoints).map(breakpoint => (
            <li
              key={breakpoint}
              className="flex items-center"
              style={{ height: 32 }}
            >
              <label className="input">
                <span className="text-grey">{breakpoint}</span>
                <input
                  type="text"
                  value={breakpoints[breakpoint]}
                  onChange={e => {
                    setBreakpoints({
                      ...breakpoints,
                      [breakpoint]: e.target.value
                    })
                  }}
                />
              </label>
            </li>
          ))}
        </ul>
      </section>
      <section
        style={{ boxShadow: '0 1px 0 0 rgba(0, 0, 0, .1)', padding: '8px 0' }}
      >
        <h2
          className="font-semibold flex items-center"
          style={{
            padding: '0 16px',
            height: 32
          }}
        >
          Font Stacks
        </h2>

        <ul style={{ padding: '0 8px' }}>
          {Object.keys(fonts).map(font => (
            <li key={font} className="flex items-center" style={{ height: 32 }}>
              <label className="input">
                <span className="text-grey">{font},</span>
                <input
                  type="text"
                  value={fonts[font]}
                  onChange={e => {
                    setFonts({ ...fonts, [font]: e.target.value })
                  }}
                />
              </label>
            </li>
          ))}
        </ul>
      </section>
      <section style={{ padding: '8px 0' }}>
        <h2
          className="font-semibold flex items-center"
          style={{
            padding: '0 16px',
            height: 32
          }}
        >
          Export
        </h2>

        <ul style={{ padding: '0 16px' }}>
          {Object.keys(config).map((style, i) => (
            <li
              key={style}
              className="flex items-center"
              style={{ height: 32 }}
            >
              <input
                type="checkbox"
                className="checkbox sr-only"
                id={`style-${i}`}
                checked={selectedStyles.indexOf(style) !== -1}
                onChange={e => {
                  if (e.target.checked) {
                    setSelectedStyles(selectedStyles => [
                      ...selectedStyles,
                      style
                    ])
                  } else {
                    setSelectedStyles(selectedStyles =>
                      selectedStyles.filter(font => font !== style)
                    )
                  }
                }}
              />
              <label
                htmlFor={`style-${i}`}
                className="flex items-center justify-between w-full"
                style={{ height: 32 }}
              >
                <div>{style}</div>
                <div className="text-grey">2 sizes</div>
              </label>
            </li>
          ))}
        </ul>
      </section>
      <footer className="mt-auto" style={{ padding: 16 }}>
        <button type="button" className="button w-full" onClick={exportJson}>
          Export
        </button>
      </footer>
    </main>
  ) : null
}

ReactDOM.render(<App />, document.getElementById('app'))

function toKebabCase(str: string): string {
  return str.replace(/\s+/g, '-').toLowerCase()
}
