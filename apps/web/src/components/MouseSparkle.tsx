import { useEffect } from 'react'

export default function MouseSparkle() {
  useEffect(() => {
    const colour = "random"
    const sparkles = 50

    let x = 400, ox = 400
    let y = 300, oy = 300
    let shigh = 600

    const tiny: HTMLDivElement[] = []
    const star: HTMLDivElement[] = []
    const starv: number[] = []
    const starx: number[] = []
    const stary: number[] = []
    const tinyv: number[] = []
    const tinyx: number[] = []
    const tinyy: number[] = []

    function createDiv(height: number, width: number, isChild = false): HTMLDivElement {
      const div = document.createElement("div")
      div.style.position = isChild ? "absolute" : "fixed"
      div.style.height = height + "px"
      div.style.width = width + "px"
      div.style.overflow = "hidden"
      div.style.pointerEvents = "none"
      return div
    }

    function newColour(): string {
      const c: number[] = []
      c[0] = 255
      c[1] = Math.floor(Math.random() * 256)
      c[2] = Math.floor(Math.random() * (256 - c[1] / 2))
      c.sort(() => 0.5 - Math.random())
      return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
    }

    function setWidth() {
      let shMin = 999999
      if (document.documentElement?.clientHeight) {
        if (document.documentElement.clientHeight > 0) shMin = document.documentElement.clientHeight
      }
      if (typeof self.innerHeight === 'number' && self.innerHeight) {
        if (self.innerHeight > 0 && self.innerHeight < shMin) shMin = self.innerHeight
      }
      if (document.body.clientHeight) {
        if (document.body.clientHeight > 0 && document.body.clientHeight < shMin) shMin = document.body.clientHeight
      }
      if (shMin === 999999) {
        shMin = 600
      }
      shigh = shMin
    }

    function updateTiny(i: number) {
      const tinyEl = tiny[i]
      if (!tinyEl) return

      tinyv[i] = (tinyv[i] ?? 0) - 1
      if (tinyv[i] === 25) {
        tinyEl.style.width = "1px"
        tinyEl.style.height = "1px"
      }
      if (tinyv[i]) {
        tinyy[i] = (tinyy[i] ?? 0) + 1 + Math.random() * 3
        tinyx[i] = (tinyx[i] ?? 0) + (i % 5 - 2) / 5
        if ((tinyy[i] ?? 0) < shigh) {
          tinyEl.style.top = tinyy[i] + "px"
          tinyEl.style.left = tinyx[i] + "px"
        } else {
          tinyEl.style.visibility = "hidden"
          tinyv[i] = 0
        }
      } else {
        tinyEl.style.visibility = "hidden"
      }
    }

    function updateStar(i: number) {
      const starEl = star[i]
      const tinyEl = tiny[i]
      if (!starEl || !tinyEl) return

      starv[i] = (starv[i] ?? 0) - 1
      if (starv[i] === 25) starEl.style.clip = "rect(1px, 4px, 4px, 1px)"
      if (starv[i]) {
        stary[i] = (stary[i] ?? 0) + 1 + Math.random() * 3
        starx[i] = (starx[i] ?? 0) + (i % 5 - 2) / 5
        if ((stary[i] ?? 0) < shigh) {
          starEl.style.top = stary[i] + "px"
          starEl.style.left = starx[i] + "px"
        } else {
          starEl.style.visibility = "hidden"
          starv[i] = 0
        }
      } else {
        tinyv[i] = 50
        tinyy[i] = stary[i] ?? 0
        tinyx[i] = starx[i] ?? 0
        tinyEl.style.top = tinyy[i] + "px"
        tinyEl.style.left = tinyx[i] + "px"
        tinyEl.style.width = "2px"
        tinyEl.style.height = "2px"
        const starChild = starEl.childNodes[0] as HTMLElement | undefined
        if (starChild) {
          tinyEl.style.backgroundColor = starChild.style.backgroundColor
        }
        starEl.style.visibility = "hidden"
        tinyEl.style.visibility = "visible"
      }
    }

    let animationId: number

    function sparkle() {
      if (Math.abs(x - ox) > 1 || Math.abs(y - oy) > 1) {
        ox = x
        oy = y
        for (let c = 0; c < sparkles; c++) {
          const starEl = star[c]
          if (!starEl) continue
          if (!starv[c]) {
            starEl.style.left = (starx[c] = x) + "px"
            starEl.style.top = (stary[c] = y + 1) + "px"
            starEl.style.clip = "rect(0px, 5px, 5px, 0px)"
            const starChild0 = starEl.childNodes[0] as HTMLElement | undefined
            const starChild1 = starEl.childNodes[1] as HTMLElement | undefined
            const newColor = colour === "random" ? newColour() : colour
            if (starChild0) starChild0.style.backgroundColor = newColor
            if (starChild1) starChild1.style.backgroundColor = newColor
            starEl.style.visibility = "visible"
            starv[c] = 50
            break
          }
        }
      }
      for (let c = 0; c < sparkles; c++) {
        if (starv[c]) updateStar(c)
        if (tinyv[c]) updateTiny(c)
      }
      animationId = window.setTimeout(sparkle, 40)
    }

    function handleMouseMove(e: MouseEvent) {
      y = e.clientY
      x = e.clientX
    }

    // Initialize
    for (let i = 0; i < sparkles; i++) {
      const rats = createDiv(3, 3)
      rats.style.visibility = "hidden"
      rats.style.zIndex = "999"
      document.body.appendChild(rats)
      tiny[i] = rats
      starv[i] = 0
      tinyv[i] = 0

      const rats2 = createDiv(5, 5)
      rats2.style.backgroundColor = "transparent"
      rats2.style.visibility = "hidden"
      rats2.style.zIndex = "999"

      const rlef = createDiv(1, 5, true)
      const rdow = createDiv(5, 1, true)
      rats2.appendChild(rlef)
      rats2.appendChild(rdow)
      rlef.style.top = "2px"
      rlef.style.left = "0px"
      rdow.style.top = "0px"
      rdow.style.left = "2px"

      document.body.appendChild(rats2)
      star[i] = rats2
    }

    setWidth()
    sparkle()

    document.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('resize', setWidth)

    // Cleanup
    return () => {
      clearTimeout(animationId)
      document.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('resize', setWidth)

      tiny.forEach(el => el.remove())
      star.forEach(el => el.remove())
    }
  }, [])

  return null
}
