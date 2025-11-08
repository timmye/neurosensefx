Neurosensefx UX architechture - how traders see and use the interface.
Definitions: ADR: average daily range, 

Workspace
    - Symbol Palette
        - search
            -fuzzy
        - subscribe and create symbol canvas
    -FloatingDisplay
        - Header
            - symbol, close button
        - Display Canvas
        Core charateristics: adrAXIS y axis where all ADR and price a refrerenced. Has a x location
        Y axis and height: Visual price anchor/reference for traders 
            - dayRangeMeter (shows price relative to ADR on the adrAxis, y position)
                - adrAxis, 0, ADR markers, open,high,low
            - priceFloat (tracks price up and down)
                - y position, width, height, colour, shape, dynamics
            - priceDisplay (shows price digits tracks price up and down)
                - y position, x offset from adrAxis, font, colours, size, format, dynamics 
            - marketProfile (shows the distribution of price activity horizontally from adrAxis)
                - width, colour, plot type
            - volatilityOrb (shows volatility)
                - size, colour, location, dynamics
                - volatilityMetric
            - priceMarkers (horizontal price markers traders can place on canvas)
                - height, colour, price format
            - unknown status
                - hover indicator (unknown status - )
                - marketPulse (unknown status - not working)
    - multiSymbolADR (unkown status - not working) (shows subscribed symbols ADR% plotted on a y axis for comparison)

UnifiedContexMenu
    Shows relevant user controls wherever trader right clicks
    - Workspace
    - Floating Dispaly header
    - Canvas
