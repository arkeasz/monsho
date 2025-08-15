export const getReports = async () => {
    const res = await fetch(
        `${process.env.NEXT_PUBLIC_FUNCTIONS_URL}/daily/reports`,
        {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        }
    )

    if (!res.ok) {
        const errorBody = await res.json().catch(() => null)
        throw new Error(
            `Error ${res.status}: ${errorBody?.error || res.statusText}`
        )
    }

    return await res.json()
}

export const getReportByDate = async (date: string) => {
    const res = await fetch(
        `${process.env.NEXT_PUBLIC_FUNCTIONS_URL}/daily/reports/${encodeURIComponent(date)}`,
        {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        }
    )

    if (!res.ok) {
        const errorBody = await res.json().catch(() => null)
        throw new Error(
            `Error ${res.status}: ${errorBody?.error || res.statusText}`
        )
    }

    return await res.json()
}

export const updateReport = async (date: string, utilities: number) => {
    const res = await fetch(
        `${process.env.NEXT_PUBLIC_FUNCTIONS_URL}/daily/reports/${encodeURIComponent(date)}`,
        {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ utilities }) // Solo enviamos utilities
        }
    )

    if (!res.ok) {
        const errorBody = await res.json().catch(() => null)
        throw new Error(
            `Error ${res.status}: ${errorBody?.error || res.statusText}`
        )
    }

    return await res.json()

}