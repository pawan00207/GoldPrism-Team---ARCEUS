'use client'

import * as React from 'react'
import { Github, Heart, Linkedin, Scale, TrendingUp } from 'lucide-react'

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border/80 bg-card/40">
      <div className="container mx-auto px-4 max-w-7xl py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 font-bold mb-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black font-black text-sm">
                ▲
              </div>
              <span className="text-base font-black tracking-tight">
                Gold<span className="text-amber-400">Prism</span>
              </span>
            </div>
            <p className="text-sm font-medium text-amber-200/80 mb-2">
              Prism That Explains Scattered Gold
            </p>
            <p className="text-xs text-muted-foreground max-w-md leading-relaxed mb-4">
              Developed by <strong>Team ARCEUS</strong> (Pawan Singh, Manik Khurana, Vikas Shukla) for <strong>Hack in Hills '26 · Track 03: Commodity Derivatives Intelligence</strong>.
              Transforms noisy MCX Gold calendar spreads into audited basis, carry, settlement artifact, and residual components.
            </p>
            <div className="flex items-center gap-3">
              <a
                href="https://github.com/pawan00207/GoldPrism"
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="GitHub"
              >
                <Github className="w-5 h-5" />
              </a>
              <a
                href="https://linkedin.com/in/pawan-singh-555423322/"
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="LinkedIn"
              >
                <Linkedin className="w-5 h-5 text-blue-400" />
              </a>
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold mb-3 text-foreground">GoldPrism Research</div>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li><a href="#data-health" className="hover:text-amber-300">Data Health &amp; Ingestion</a></li>
              <li><a href="#contract-master" className="hover:text-amber-300">MCX Contract Master</a></li>
              <li><a href="#xray-waterfall" className="hover:text-amber-300">X-Ray Waterfall</a></li>
              <li><a href="#best-vehicle" className="hover:text-amber-300">Best Vehicle Ranking</a></li>
              <li><a href="#backtest-lab" className="hover:text-amber-300">Backtest Lab (Walk-Forward)</a></li>
              <li><a href="#judge-demo" className="hover:text-amber-300">5-Minute Judge Demo</a></li>
              <li><a href="#reports" className="hover:text-amber-300">Audit Reports &amp; Exports</a></li>
              <li><a href="#team-arceus" className="hover:text-amber-300">Team ARCEUS &amp; Pawan Singh</a></li>
            </ul>
          </div>

          <div>
            <div className="text-sm font-semibold mb-3 text-foreground">Preserved Global Tools</div>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li><a href="#dashboard" className="hover:text-foreground">Global Markets Dashboard</a></li>
              <li><a href="#agent" className="hover:text-foreground">AI Research Agent</a></li>
              <li><a href="#alphas" className="hover:text-foreground">Alpha Zoo (456 Factors)</a></li>
              <li><a href="#paper-trading" className="hover:text-foreground">Paper Trading Arena</a></li>
              <li><a href="#shadow" className="hover:text-foreground">Shadow Account Journal</a></li>
              <li><a href="#swarm" className="hover:text-foreground">Multi-Agent Swarm (6 Presets)</a></li>
              <li><a href="#builder" className="hover:text-foreground">Strategy Builder &amp; Backtester</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <div>
            © {new Date().getFullYear()} GoldPrism by Pawan Singh &amp; Team ARCEUS · MIT License
          </div>
          <div className="flex items-center gap-1 font-mono text-[11px]">
            Hack in Hills '26 Track 03 · DTC GGSIPU
          </div>
        </div>
      </div>
    </footer>
  )
}
