(function () {
  "use strict";

  const data = window.STREAMING_DASHBOARD_DATA;
  const F = {
    platform: 0,
    genre: 1,
    year: 2,
    country: 3,
    score10: 4,
    band: 5,
    age: 6,
    gap: 7,
    opp: 8,
    demand10: 9,
    views10: 10,
    completion10: 11
  };

  const colors = {
    "Netflix": "#ff4b55",
    "Disney+": "#2a7bff",
    "Prime Video": "#21d4e8",
    axis: "rgba(155, 183, 200, 0.22)",
    text: "#f4f8ff",
    muted: "#9bb7c8",
    cyan: "#21d4e8",
    green: "#22e6c3",
    purple: "#a95cff"
  };

  const els = {
    platform: document.getElementById("platformFilter"),
    genre: document.getElementById("genreFilter"),
    year: document.getElementById("yearFilter"),
    rating: document.getElementById("ratingFilter"),
    country: document.getElementById("countryFilter"),
    reset: document.getElementById("resetFilters"),
    exportCsv: document.getElementById("downloadCsv"),
    kpiTitles: document.getElementById("kpiTitles"),
    kpiRating: document.getElementById("kpiRating"),
    kpiCountries: document.getElementById("kpiCountries"),
    kpiGenres: document.getElementById("kpiGenres"),
    kpiGap: document.getElementById("kpiGap"),
    kpiTitlesDelta: document.getElementById("kpiTitlesDelta"),
    kpiRatingDelta: document.getElementById("kpiRatingDelta"),
    kpiCountriesDelta: document.getElementById("kpiCountriesDelta"),
    kpiGenresDelta: document.getElementById("kpiGenresDelta"),
    kpiGapDelta: document.getElementById("kpiGapDelta"),
    genreLegend: document.getElementById("genreLegend"),
    releaseLegend: document.getElementById("releaseLegend"),
    shareLegend: document.getElementById("shareLegend"),
    shareTotal: document.getElementById("shareTotal"),
    gapCards: document.getElementById("gapCards")
  };

  function svgEl(tag, attrs) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attrs || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        node.setAttribute(key, String(value));
      }
    });
    return node;
  }

  function clear(id) {
    const node = document.getElementById(id);
    while (node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("en-US").format(Math.round(value || 0));
  }

  function formatShort(value) {
    if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K`;
    return String(Math.round(value));
  }

  function option(select, value, label) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    select.appendChild(opt);
  }

  function populateSelect(select, values, labels) {
    select.innerHTML = "";
    option(select, "", "All");
    values.forEach((value, index) => option(select, value, labels ? labels[index] : value));
  }

  function initializeFilters() {
    populateSelect(els.platform, data.platforms.map((_, i) => String(i)), data.platforms);
    populateSelect(els.genre, data.genres.map((_, i) => String(i)), data.genres);
    const years = Array.from(new Set(data.rows.map((row) => row[F.year]))).sort((a, b) => a - b);
    populateSelect(els.year, years.map(String), years.map(String));
    populateSelect(els.rating, data.ageRatings.map((_, i) => String(i)), data.ageRatings);
    const countries = data.countries
      .map((country, index) => ({ index, name: country.n }))
      .sort((a, b) => a.name.localeCompare(b.name));
    populateSelect(els.country, countries.map((item) => String(item.index)), countries.map((item) => item.name));
  }

  function currentFilters() {
    return {
      platform: els.platform.value === "" ? null : Number(els.platform.value),
      genre: els.genre.value === "" ? null : Number(els.genre.value),
      year: els.year.value === "" ? null : Number(els.year.value),
      rating: els.rating.value === "" ? null : Number(els.rating.value),
      country: els.country.value === "" ? null : Number(els.country.value)
    };
  }

  function filterRows() {
    const f = currentFilters();
    return data.rows.filter((row) => {
      if (f.platform !== null && row[F.platform] !== f.platform) return false;
      if (f.genre !== null && row[F.genre] !== f.genre) return false;
      if (f.year !== null && row[F.year] !== f.year) return false;
      if (f.rating !== null && row[F.age] !== f.rating) return false;
      if (f.country !== null && row[F.country] !== f.country) return false;
      return true;
    });
  }

  function emptyMatrix(primary, secondary) {
    return Array.from({ length: primary }, () => Array.from({ length: secondary }, () => 0));
  }

  function summarize(rows) {
    const years = Array.from(new Set(data.rows.map((row) => row[F.year]))).sort((a, b) => a - b);
    const byGenrePlatform = emptyMatrix(data.genres.length, data.platforms.length);
    const byYearPlatform = emptyMatrix(years.length, data.platforms.length);
    const byRatingBand = Array.from({ length: data.ratingBands.length }, () => 0);
    const byPlatform = Array.from({ length: data.platforms.length }, () => 0);
    const byCountry = new Map();
    const gapAgg = new Map();
    const countrySet = new Set();
    const genreSet = new Set();
    const sparkByYear = Array.from({ length: years.length }, () => ({
      titles: 0,
      ratingTotal: 0,
      oppTotal: 0,
      countries: new Set(),
      genres: new Set()
    }));

    let ratingTotal = 0;
    let opportunityTotal = 0;
    let demandTotal = 0;
    let viewsTotal = 0;

    rows.forEach((row) => {
      const yearIndex = years.indexOf(row[F.year]);
      byGenrePlatform[row[F.genre]][row[F.platform]] += 1;
      byYearPlatform[yearIndex][row[F.platform]] += 1;
      byRatingBand[row[F.band]] += 1;
      byPlatform[row[F.platform]] += 1;
      countrySet.add(row[F.country]);
      genreSet.add(row[F.genre]);
      ratingTotal += row[F.score10] / 10;
      opportunityTotal += row[F.opp];
      demandTotal += row[F.demand10] / 10;
      viewsTotal += row[F.views10] / 10;

      const countryValue = byCountry.get(row[F.country]) || { count: 0, opp: 0 };
      countryValue.count += 1;
      countryValue.opp += row[F.opp];
      byCountry.set(row[F.country], countryValue);

      const gapValue = gapAgg.get(row[F.gap]) || { count: 0, opp: 0, demand: 0 };
      gapValue.count += 1;
      gapValue.opp += row[F.opp];
      gapValue.demand += row[F.demand10] / 10;
      gapAgg.set(row[F.gap], gapValue);

      const spark = sparkByYear[yearIndex];
      spark.titles += 1;
      spark.ratingTotal += row[F.score10] / 10;
      spark.oppTotal += row[F.opp];
      spark.countries.add(row[F.country]);
      spark.genres.add(row[F.genre]);
    });

    const total = rows.length;
    return {
      total,
      avgRating: total ? ratingTotal / total : 0,
      activeCountries: countrySet.size,
      genreCount: genreSet.size,
      gapScore: total ? opportunityTotal / total : 0,
      avgDemand: total ? demandTotal / total : 0,
      viewsTotal,
      years,
      byGenrePlatform,
      byYearPlatform,
      byRatingBand,
      byPlatform,
      byCountry,
      gapAgg,
      sparkByYear
    };
  }

  function setDelta(el, value, baseline, suffix) {
    const delta = value - baseline;
    const rounded = Math.abs(delta) >= 10 ? Math.round(delta) : Number(delta.toFixed(2));
    el.classList.toggle("positive", delta >= 0);
    el.textContent = `${delta >= 0 ? "+" : "-"} ${Math.abs(rounded)} ${suffix}`;
  }

  function updateKpis(summary) {
    els.kpiTitles.textContent = formatNumber(summary.total);
    els.kpiRating.textContent = summary.avgRating.toFixed(2);
    els.kpiCountries.textContent = formatNumber(summary.activeCountries);
    els.kpiGenres.textContent = formatNumber(summary.genreCount);
    els.kpiGap.textContent = Math.round(summary.gapScore);

    setDelta(els.kpiTitlesDelta, summary.total, 26520, "vs Apr 10, 2024");
    setDelta(els.kpiRatingDelta, summary.avgRating, 6.6, "vs Apr 10, 2024");
    setDelta(els.kpiCountriesDelta, summary.activeCountries, 36, "vs Apr 10, 2024");
    setDelta(els.kpiGenresDelta, summary.genreCount, 10, "vs Apr 10, 2024");
    setDelta(els.kpiGapDelta, summary.gapScore, 58, "vs Apr 10, 2024");

    drawSparkline("sparkTitles", summary.sparkByYear.map((d) => d.titles));
    drawSparkline("sparkRating", summary.sparkByYear.map((d) => d.titles ? d.ratingTotal / d.titles : 0));
    drawSparkline("sparkCountries", summary.sparkByYear.map((d) => d.countries.size));
    drawSparkline("sparkGenres", summary.sparkByYear.map((d) => d.genres.size));
    drawMiniDonut("gapDonut", Math.max(0, Math.min(100, summary.gapScore)));
  }

  function drawSparkline(id, values) {
    const svg = clear(id);
    const width = 110;
    const height = 34;
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 1);
    const range = max - min || 1;
    const points = values.map((value, index) => {
      const x = values.length === 1 ? width : (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - 8) - 4;
      return [x, y];
    });
    if (!points.length) return;
    const path = points.map((point, index) => `${index ? "L" : "M"}${point[0].toFixed(1)},${point[1].toFixed(1)}`).join(" ");
    const area = `0,${height} ${points.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")} ${width},${height}`;
    svg.appendChild(svgEl("polygon", { points: area }));
    svg.appendChild(svgEl("path", { d: path }));
  }

  function drawMiniDonut(id, score) {
    const svg = clear(id);
    const cx = 46;
    const cy = 46;
    const r = 31;
    const c = 2 * Math.PI * r;
    svg.appendChild(svgEl("circle", {
      cx, cy, r,
      fill: "none",
      stroke: "rgba(155, 183, 200, 0.18)",
      "stroke-width": 12
    }));
    svg.appendChild(svgEl("circle", {
      cx, cy, r,
      fill: "none",
      stroke: colors.cyan,
      "stroke-width": 12,
      "stroke-linecap": "round",
      "stroke-dasharray": `${(score / 100) * c} ${c}`,
      transform: `rotate(-90 ${cx} ${cy})`
    }));
  }

  function niceMax(value) {
    if (value <= 0) return 1;
    const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
    return Math.ceil(value / magnitude) * magnitude;
  }

  function legendHTML(items) {
    return items.map((item) => `<span><i style="background:${item.color}"></i>${item.label}</span>`).join("");
  }

  function drawGenreChart(summary) {
    els.genreLegend.innerHTML = legendHTML(data.platforms.map((platform) => ({ label: platform, color: colors[platform] })));
    const svg = clear("genreChart");
    const w = 760;
    const h = 300;
    const margin = { top: 18, right: 12, bottom: 54, left: 48 };
    const plotW = w - margin.left - margin.right;
    const plotH = h - margin.top - margin.bottom;
    const max = niceMax(Math.max(...summary.byGenrePlatform.flat(), 1));
    const groupW = plotW / data.genres.length;
    const barW = Math.min(16, groupW / (data.platforms.length + 1.7));

    drawYAxis(svg, margin, plotW, plotH, max, 5, (v) => formatShort(v));

    data.genres.forEach((genre, genreIndex) => {
      const groupX = margin.left + genreIndex * groupW;
      data.platforms.forEach((platform, platformIndex) => {
        const value = summary.byGenrePlatform[genreIndex][platformIndex];
        const barH = (value / max) * plotH;
        const x = groupX + groupW / 2 - (barW * data.platforms.length) / 2 + platformIndex * barW;
        const y = margin.top + plotH - barH;
        svg.appendChild(svgEl("rect", {
          class: "rating-bar",
          x,
          y,
          width: barW - 2,
          height: Math.max(0, barH),
          rx: 2,
          fill: colors[platform]
        }));
        if (value > max * 0.12) {
          const label = svgEl("text", {
            class: "bar-label",
            x: x + barW / 2,
            y: y - 5,
            "text-anchor": "middle"
          });
          label.textContent = formatShort(value);
          svg.appendChild(label);
        }
      });

      const label = svgEl("text", {
        class: "axis",
        x: groupX + groupW / 2,
        y: h - 34,
        "text-anchor": "middle"
      });
      const labelParts = {
        "Documentary": ["Docu."],
        "Kids & Family": ["Kids", "Family"],
        "Sci-Fi & Fantasy": ["Sci-Fi", "Fantasy"]
      };
      const parts = labelParts[genre] || [genre];
      parts.forEach((part, index) => {
        const tspan = svgEl("tspan", { x: groupX + groupW / 2, dy: index ? 13 : 0 });
        tspan.textContent = part;
        label.appendChild(tspan);
      });
      svg.appendChild(label);
    });
  }

  function drawYAxis(svg, margin, plotW, plotH, max, ticks, formatter) {
    for (let i = 0; i <= ticks; i += 1) {
      const value = (max / ticks) * i;
      const y = margin.top + plotH - (value / max) * plotH;
      svg.appendChild(svgEl("line", {
        class: "grid-line",
        x1: margin.left,
        x2: margin.left + plotW,
        y1: y,
        y2: y
      }));
      const text = svgEl("text", {
        class: "axis",
        x: margin.left - 10,
        y: y + 4,
        "text-anchor": "end"
      });
      text.textContent = formatter(value);
      svg.appendChild(text);
    }
  }

  function drawCountryMap(summary) {
    const svg = clear("countryMap");
    const w = 650;
    const h = 300;
    const margin = { top: 14, right: 10, bottom: 12, left: 10 };
    const plotW = w - margin.left - margin.right;
    const plotH = h - margin.top - margin.bottom;

    for (let x = margin.left; x <= w - margin.right; x += 52) {
      svg.appendChild(svgEl("line", { class: "map-grid", x1: x, x2: x, y1: margin.top, y2: h - margin.bottom }));
    }
    for (let y = margin.top; y <= h - margin.bottom; y += 42) {
      svg.appendChild(svgEl("line", { class: "map-grid", x1: margin.left, x2: w - margin.right, y1: y, y2: y }));
    }

    const landPaths = [
      "M70,78 L148,58 L220,82 L190,136 L112,126 Z",
      "M215,72 L285,50 L330,91 L306,138 L236,131 Z",
      "M298,95 L386,70 L474,99 L453,150 L350,146 Z",
      "M430,136 L492,118 L560,154 L532,207 L455,190 Z",
      "M168,142 L225,156 L212,232 L154,216 Z",
      "M382,152 L434,168 L418,238 L356,226 Z",
      "M505,211 L564,222 L586,250 L532,264 Z"
    ];
    landPaths.forEach((d) => svg.appendChild(svgEl("path", { class: "land-mass", d })));

    const countries = Array.from(summary.byCountry.entries())
      .map(([countryIndex, value]) => ({
        index: Number(countryIndex),
        count: value.count,
        avgOpp: value.count ? value.opp / value.count : 0,
        ...data.countries[countryIndex]
      }))
      .sort((a, b) => a.count - b.count);
    const max = Math.max(...countries.map((country) => country.count), 1);
    const topLabels = countries.slice().sort((a, b) => b.count - a.count).slice(0, 6).map((country) => country.index);

    countries.forEach((country) => {
      const x = margin.left + ((country.lon + 180) / 360) * plotW;
      const y = margin.top + ((90 - country.lat) / 180) * plotH;
      const r = 5 + Math.sqrt(country.count / max) * 24;
      svg.appendChild(svgEl("circle", {
        class: "country-bubble",
        cx: x,
        cy: y,
        r,
        opacity: 0.45 + Math.min(0.45, country.avgOpp / 140)
      }));
      if (topLabels.includes(country.index)) {
        const text = svgEl("text", { class: "map-label", x: x + r + 8, y: y + 2 });
        text.textContent = `${country.n} ${formatNumber(country.count)}`;
        svg.appendChild(text);
      }
    });
  }

  function pointPath(points) {
    return points.map((point, index) => `${index ? "L" : "M"}${point[0].toFixed(1)},${point[1].toFixed(1)}`).join(" ");
  }

  function drawReleaseChart(summary) {
    els.releaseLegend.innerHTML = legendHTML([
      ...data.platforms.map((platform) => ({ label: platform, color: colors[platform] })),
      { label: "Total", color: colors.cyan }
    ]);
    const svg = clear("releaseChart");
    const w = 540;
    const h = 270;
    const margin = { top: 18, right: 16, bottom: 42, left: 48 };
    const plotW = w - margin.left - margin.right;
    const plotH = h - margin.top - margin.bottom;
    const totals = summary.byYearPlatform.map((row) => row.reduce((sum, value) => sum + value, 0));
    const max = niceMax(Math.max(...totals, 1));

    drawYAxis(svg, margin, plotW, plotH, max, 5, (v) => formatShort(v));

    const xAt = (i) => margin.left + (summary.years.length === 1 ? 0 : (i / (summary.years.length - 1)) * plotW);
    const yAt = (v) => margin.top + plotH - (v / max) * plotH;
    const totalPoints = totals.map((value, i) => [xAt(i), yAt(value)]);
    const area = [
      [margin.left, margin.top + plotH],
      ...totalPoints,
      [margin.left + plotW, margin.top + plotH]
    ].map((p) => p.join(",")).join(" ");
    svg.appendChild(svgEl("polygon", { points: area, fill: "rgba(33, 212, 232, 0.16)" }));
    svg.appendChild(svgEl("path", {
      d: pointPath(totalPoints),
      fill: "none",
      stroke: colors.cyan,
      "stroke-width": 3
    }));

    data.platforms.forEach((platform, platformIndex) => {
      const points = summary.byYearPlatform.map((row, i) => [xAt(i), yAt(row[platformIndex])]);
      svg.appendChild(svgEl("path", {
        d: pointPath(points),
        fill: "none",
        stroke: colors[platform],
        "stroke-width": 2,
        opacity: 0.86
      }));
    });

    summary.years.forEach((year, index) => {
      const x = xAt(index);
      const text = svgEl("text", { class: "axis", x, y: h - 16, "text-anchor": "middle" });
      text.textContent = year === 2024 ? "2024*" : String(year);
      svg.appendChild(text);
    });
  }

  function drawRatingChart(summary) {
    const svg = clear("ratingChart");
    const w = 470;
    const h = 270;
    const margin = { top: 18, right: 16, bottom: 42, left: 48 };
    const plotW = w - margin.left - margin.right;
    const plotH = h - margin.top - margin.bottom;
    const percents = summary.byRatingBand.map((count) => summary.total ? (count / summary.total) * 100 : 0);
    const max = Math.max(30, Math.ceil(Math.max(...percents, 1) / 5) * 5);
    drawYAxis(svg, margin, plotW, plotH, max, 3, (v) => `${Math.round(v)}%`);
    const bandW = plotW / data.ratingBands.length;
    const barW = Math.min(34, bandW * 0.54);

    data.ratingBands.forEach((band, index) => {
      const value = percents[index];
      const barH = (value / max) * plotH;
      const x = margin.left + index * bandW + (bandW - barW) / 2;
      const y = margin.top + plotH - barH;
      svg.appendChild(svgEl("rect", {
        class: "rating-bar",
        x,
        y,
        width: barW,
        height: Math.max(0, barH),
        rx: 3,
        fill: colors.cyan
      }));
      const valueText = svgEl("text", { class: "rating-label", x: x + barW / 2, y: y - 6, "text-anchor": "middle" });
      valueText.textContent = `${value.toFixed(1)}%`;
      svg.appendChild(valueText);
      const label = svgEl("text", { class: "axis", x: x + barW / 2, y: h - 18, "text-anchor": "middle" });
      label.textContent = band;
      svg.appendChild(label);
    });
  }

  function drawShareDonut(summary) {
    const svg = clear("shareDonut");
    const cx = 115;
    const cy = 115;
    const r = 70;
    const c = 2 * Math.PI * r;
    let offset = 0;
    svg.appendChild(svgEl("circle", {
      cx, cy, r,
      fill: "none",
      stroke: "rgba(155, 183, 200, 0.16)",
      "stroke-width": 34
    }));

    summary.byPlatform.forEach((count, platformIndex) => {
      const share = summary.total ? count / summary.total : 0;
      const platform = data.platforms[platformIndex];
      svg.appendChild(svgEl("circle", {
        cx, cy, r,
        fill: "none",
        stroke: colors[platform],
        "stroke-width": 34,
        "stroke-dasharray": `${share * c} ${c}`,
        "stroke-dashoffset": -offset,
        transform: `rotate(-90 ${cx} ${cy})`
      }));
      offset += share * c;
    });

    const totalText = svgEl("text", { x: cx, y: cy - 4, "text-anchor": "middle", fill: colors.text, "font-size": 22, "font-weight": 800 });
    totalText.textContent = formatNumber(summary.total);
    svg.appendChild(totalText);
    const labelText = svgEl("text", { x: cx, y: cy + 19, "text-anchor": "middle", fill: colors.muted, "font-size": 12 });
    labelText.textContent = "Total Titles";
    svg.appendChild(labelText);

    els.shareLegend.innerHTML = data.platforms.map((platform, platformIndex) => {
      const count = summary.byPlatform[platformIndex];
      const share = summary.total ? (count / summary.total) * 100 : 0;
      return `<div class="share-row">
        <span><i class="share-dot" style="background:${colors[platform]}"></i>${platform}</span>
        <strong>${share.toFixed(1)}%</strong>
        <small>${formatNumber(count)}</small>
      </div>`;
    }).join("");
    els.shareTotal.textContent = formatNumber(summary.total);
  }

  function drawGapCards(summary) {
    const fallback = data.opportunities.map((item) => ({
      title: item.opportunity,
      insight: item.insight,
      score: item.score,
      count: 0,
      label: "Opportunity Score"
    }));

    const dynamicCards = Array.from(summary.gapAgg.entries())
      .map(([gapIndex, value]) => {
        const title = data.gapSegments[gapIndex];
        const staticInfo = data.opportunities.find((item) => item.opportunity === title);
        return {
          title,
          insight: staticInfo ? staticInfo.insight : "This segment has enough demand signal to deserve a closer catalog review.",
          score: value.count ? value.opp / value.count : 0,
          count: value.count,
          label: `${formatNumber(value.count)} titles`
        };
      })
      .sort((a, b) => (b.score * Math.log10(b.count + 10)) - (a.score * Math.log10(a.count + 10)))
      .slice(0, 3);

    const cards = dynamicCards.length ? dynamicCards : fallback.slice(0, 3);
    els.gapCards.innerHTML = cards.map((card, index) => {
      const acronym = card.title.split(" ").filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
      return `<article class="gap-card">
        <span class="gap-card-icon">${acronym || index + 1}</span>
        <div>
          <h3>${escapeHtml(card.title)}</h3>
          <p>${escapeHtml(card.insight)}</p>
          <small>${escapeHtml(card.label)}</small>
        </div>
        <span class="score-pill">${Math.round(card.score)}</span>
      </article>`;
    }).join("");
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function downloadCurrentCsv(rows) {
    const headers = [
      "Platform",
      "Genre",
      "Release Year",
      "Country",
      "Age Rating",
      "Rating Score",
      "Rating Band",
      "Content Gap Segment",
      "Opportunity Score",
      "Demand Index",
      "Monthly Views M",
      "Completion Rate"
    ];
    const lines = [headers.join(",")];
    rows.forEach((row) => {
      const values = [
        data.platforms[row[F.platform]],
        data.genres[row[F.genre]],
        row[F.year],
        data.countries[row[F.country]].n,
        data.ageRatings[row[F.age]],
        (row[F.score10] / 10).toFixed(1),
        data.ratingBands[row[F.band]],
        data.gapSegments[row[F.gap]],
        row[F.opp],
        (row[F.demand10] / 10).toFixed(1),
        (row[F.views10] / 10).toFixed(1),
        (row[F.completion10] / 10).toFixed(1)
      ];
      lines.push(values.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "streaming_dashboard_filtered_view.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function render() {
    const rows = filterRows();
    const summary = summarize(rows);
    updateKpis(summary);
    drawGenreChart(summary);
    drawCountryMap(summary);
    drawReleaseChart(summary);
    drawRatingChart(summary);
    drawShareDonut(summary);
    drawGapCards(summary);
    window.__currentFilteredRows = rows;
  }

  function initializeNav() {
    document.querySelectorAll(".nav-item").forEach((item) => {
      item.addEventListener("click", () => {
        document.querySelectorAll(".nav-item").forEach((nav) => nav.classList.remove("active"));
        item.classList.add("active");
      });
    });
  }

  function initialize() {
    if (!data || !Array.isArray(data.rows)) {
      document.body.innerHTML = "<main class='dashboard'><h1>Dashboard data was not found.</h1></main>";
      return;
    }
    initializeFilters();
    initializeNav();
    [els.platform, els.genre, els.year, els.rating, els.country].forEach((select) => select.addEventListener("change", render));
    els.reset.addEventListener("click", () => {
      [els.platform, els.genre, els.year, els.rating, els.country].forEach((select) => {
        select.value = "";
      });
      render();
    });
    els.exportCsv.addEventListener("click", () => downloadCurrentCsv(window.__currentFilteredRows || filterRows()));
    render();
  }

  initialize();
})();
