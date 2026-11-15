/**
 * Yürüyüş zorluğu eşikleri (uzay giysili insan, Jezero/Mars arazisi).
 *
 * Bunlar yaklaşık, literatürden türetilmiş değerlerdir ve tek yerden ayarlanır:
 *  - ≤ 15°  (~%27 eğim): Normal yürüyüş; yük taşıyarak da sürdürülebilir, yorgunluk artar ama sorun olmaz.
 *  - 15–20° (~%27–36):   Zorlu. Metabolik maliyet hızla artar, Apollo EVA'larında bu eğimler yavaşlatıcıydı.
 *  - 20–30° (~%36–58):   ÖNERİLMEZ. Adım atmak yerine tırmanmaya yaklaşılır; giysi, oksijen yükü ve
 *                        gevşek regolitte ayak tutuşu nedeniyle denge/yorgunluk riski yüksektir.
 *  - > 30°:              TEHLİKELİ. Gevşek toprak/regolitin dayanma (angle of repose) açısı ≈ 30–35°;
 *                        bu eşikte zemin kayar. Tırmanış ekipmanı olmadan yürünmez.
 */
export const COMFORTABLE_MAX_DEG = 15
export const RECOMMENDED_MAX_DEG = 20
export const DANGEROUS_MIN_DEG = 30

export type DifficultyLevel = 'easy' | 'hard' | 'discouraged' | 'dangerous'

export function classifySlope(degrees: number): DifficultyLevel {
    if (degrees > DANGEROUS_MIN_DEG) return 'dangerous'
    if (degrees > RECOMMENDED_MAX_DEG) return 'discouraged'
    if (degrees > COMFORTABLE_MAX_DEG) return 'hard'
    return 'easy'
}

export type RouteAssessment = {
    level: DifficultyLevel
    /** true → rota çizilir ama kullanıcıya "önerilmez" uyarısı gösterilir. */
    discouraged: boolean
    /** Eğimi 20°'yi aşan kısmın yatay uzunluğu (m). */
    steepMeters: number
    /** Eğimi 30°'yi aşan kısmın yatay uzunluğu (m). */
    dangerousMeters: number
    title: string
    /** Kısa, tek cümlelik gerekçe. */
    reason: string
}

const fmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const fmt1 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })

export function assessRoute(
    maxSlope: number,
    steepMeters: number,
    dangerousMeters: number,
): RouteAssessment {
    const level = classifySlope(maxSlope)
    const max = fmt1.format(maxSlope)

    if (level === 'dangerous') {
        return {
            level, discouraged: true, steepMeters, dangerousMeters,
            title: 'Route not recommended · dangerous slope',
            reason: `About ${fmt.format(dangerousMeters)} m of the route exceeds ${DANGEROUS_MIN_DEG}° (max. ${max}°). ` +
                `Loose regolith slides at this slope; walking without climbing gear risks a fall.`,
        }
    }
    if (level === 'discouraged') {
        return {
            level, discouraged: true, steepMeters, dangerousMeters,
            title: 'Route not recommended · very steep',
            reason: `About ${fmt.format(steepMeters)} m of the route exceeds ${RECOMMENDED_MAX_DEG}° (max. ${max}°). ` +
                `Walking at this slope is extremely tiring; balance and footing suffer in a spacesuit and oxygen use rises.`,
        }
    }
    if (level === 'hard') {
        return {
            level, discouraged: false, steepMeters, dangerousMeters,
            title: 'Challenging route',
            reason: `Max. slope ${max}°. Walkable but tiring; allow time for breaks.`,
        }
    }
    return {
        level, discouraged: false, steepMeters, dangerousMeters,
        title: 'Route suitable',
        reason: `Max. slope ${max}°, comfortably walkable.`,
    }
}