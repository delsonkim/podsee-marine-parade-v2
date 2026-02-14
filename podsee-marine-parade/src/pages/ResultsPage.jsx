import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Container,
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  TextField,
  Alert,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import MyLocationIcon from '@mui/icons-material/MyLocation'
import SearchIcon from '@mui/icons-material/Search'
import { loadCentresData, filterCentres, getMatchingNote, getSubjectsForCentreAtLevel } from '../utils/dataLoader'
import CentreModal from '../components/CentreModal'
import {
  getCurrentLocation,
  initializeAutocomplete,
  geocodeCentre,
  calculateDistance,
  loadGoogleMapsAPI
} from '../utils/locationService'

// Helper to clean up duplicate postal codes in Singapore addresses (display only)
function formatSgAddress(address, postalCode) {
  if (!address) return '';
  
  // Combine address and postal code
  const fullAddress = `${address} ${postalCode || ''}`.trim();
  
  // Singapore postal codes are exactly 6 digits
  const postalCodePattern = /\b\d{6}\b/g;
  const matches = fullAddress.match(postalCodePattern);
  
  // If there are 2 or more postal codes, remove duplicates from the end
  if (matches && matches.length >= 2) {
    // Remove the last occurrence of a 6-digit postal code
    const lastMatch = matches[matches.length - 1];
    const lastIndex = fullAddress.lastIndexOf(lastMatch);
    return fullAddress.substring(0, lastIndex).trim();
  }
  
  return fullAddress;
}

function ResultsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const level = searchParams.get('level')
  const subject = searchParams.get('subject')
  const centreName = searchParams.get('centre')

  const [centres, setCentres] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCentre, setSelectedCentre] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)

  // Determine search mode: centre-name or level+subject
  const isCentreNameMode = !!centreName
  const isLevelSubjectMode = !!(level && subject)
  
  // Location-related state
  const [parentLocation, setParentLocation] = useState(null)
  const [centreDistances, setCentreDistances] = useState(new Map())
  const [locationError, setLocationError] = useState('')
  const [locationInput, setLocationInput] = useState('')
  const [isGeocodingCentres, setIsGeocodingCentres] = useState(false)
  
  const locationInputRef = useRef(null)
  const autocompleteRef = useRef(null)

  // SessionStorage key for location persistence
  const LOCATION_STORAGE_KEY = 'podsee_parent_location'
  const LOCATION_TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes

  // Restore location from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(LOCATION_STORAGE_KEY)
      if (stored) {
        const { location, timestamp } = JSON.parse(stored)
        const age = Date.now() - timestamp
        
        // Check if location is still valid (< 10 minutes old)
        if (age < LOCATION_TIMEOUT_MS) {
          setParentLocation(location)
          setLocationInput(location.address || 'Saved location')
        } else {
          // Expired, clear it
          sessionStorage.removeItem(LOCATION_STORAGE_KEY)
        }
      }
    } catch (err) {
      console.error('Failed to restore location:', err)
    }
  }, [])

  useEffect(() => {
    // Validate: must have either centre name OR (level AND subject)
    if (!isCentreNameMode && !isLevelSubjectMode) {
      navigate('/')
      return
    }

    loadCentresData()
      .then(allCentres => {
        let filtered = []

        if (isCentreNameMode) {
          // Centre-name mode: filter by centre name (case-insensitive partial match)
          const searchTerm = centreName.toLowerCase()
          filtered = allCentres.filter(centre =>
            centre.name.toLowerCase().includes(searchTerm)
          )
        } else if (isLevelSubjectMode) {
          // Level+subject mode: filter by level and subject
          filtered = filterCentres(allCentres, level, subject)
        }

        setCentres(filtered)
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to load data:', err)
        setLoading(false)
      })
  }, [level, subject, centreName, isCentreNameMode, isLevelSubjectMode, navigate])

  // Initialize Google Places Autocomplete
  useEffect(() => {
    if (locationInputRef.current && !autocompleteRef.current) {
      initializeAutocomplete(locationInputRef.current, handlePlaceSelected)
        .then(autocomplete => {
          autocompleteRef.current = autocomplete
        })
        .catch(err => {
          console.error('Failed to initialize autocomplete:', err)
        })
    }
  }, [])

  // Geocode centres and calculate distances when parent location changes
  useEffect(() => {
    if (parentLocation && centres.length > 0) {
      geocodeCentresAndCalculateDistances()
    }
  }, [parentLocation, centres])

  const handlePlaceSelected = (location) => {
    setParentLocation(location)
    setLocationError('')
    setLocationInput(location.address || '')
    
    // Save to sessionStorage with timestamp
    try {
      sessionStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify({
        location,
        timestamp: Date.now()
      }))
    } catch (err) {
      console.error('Failed to save location:', err)
    }
  }

  const handleUseCurrentLocation = async () => {
    setLocationError('')
    try {
      const location = await getCurrentLocation()
      setParentLocation(location)
      setLocationInput('Current location')
      
      // Save to sessionStorage with timestamp
      try {
        sessionStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify({
          location,
          timestamp: Date.now()
        }))
      } catch (err) {
        console.error('Failed to save location:', err)
      }
    } catch (error) {
      setLocationError(error.message)
    }
  }

  const handleSearchByAddress = async () => {
    if (!locationInput.trim()) {
      setLocationError('Please enter a location')
      return
    }

    setLocationError('')
    try {
      const google = await loadGoogleMapsAPI()
      const geocoder = new google.maps.Geocoder()

      geocoder.geocode(
        { 
          address: locationInput,
          componentRestrictions: { country: 'sg' }
        },
        (results, status) => {
          if (status === 'OK' && results[0]) {
            const location = {
              lat: results[0].geometry.location.lat(),
              lng: results[0].geometry.location.lng(),
              address: results[0].formatted_address
            }
            setParentLocation(location)
            setLocationInput(results[0].formatted_address)
            
            // Save to sessionStorage with timestamp
            try {
              sessionStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify({
                location,
                timestamp: Date.now()
              }))
            } catch (err) {
              console.error('Failed to save location:', err)
            }
          } else {
            setLocationError('Location not found. Please try again.')
          }
        }
      )
    } catch (error) {
      setLocationError('Failed to search location')
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearchByAddress()
    }
  }

  const handleLocationInputChange = (e) => {
    const value = e.target.value
    setLocationInput(value)
    
    // If user clears the input, clear the location
    if (!value.trim()) {
      setParentLocation(null)
      sessionStorage.removeItem(LOCATION_STORAGE_KEY)
    }
  }

  const geocodeCentresAndCalculateDistances = useCallback(async () => {
    if (!parentLocation) return

    setIsGeocodingCentres(true)
    const newDistances = new Map()
    let completedCount = 0

    // Geocode centres with a small delay to avoid rate limiting
    for (const centre of centres) {
      try {
        const centreLocation = await geocodeCentre(centre)
        const distance = calculateDistance(
          parentLocation.lat,
          parentLocation.lng,
          centreLocation.lat,
          centreLocation.lng
        )
        newDistances.set(centre.name, distance)
        completedCount++

        // Update distances progressively
        if (completedCount % 5 === 0 || completedCount === centres.length) {
          setCentreDistances(new Map(newDistances))
        }

        // Small delay to avoid hitting rate limits
        if (completedCount < centres.length) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      } catch (error) {
        console.error(`Failed to geocode ${centre.name}:`, error)
      }
    }

    setCentreDistances(newDistances)
    setIsGeocodingCentres(false)
  }, [parentLocation, centres])

  // Sort centres by distance only (no alphabetical fallback)
  const sortedCentres = [...centres].sort((a, b) => {
    const distA = centreDistances.get(a.name)
    const distB = centreDistances.get(b.name)

    // Both have distances - sort by distance ascending
    if (distA !== undefined && distB !== undefined) {
      return distA - distB
    }
    // Only A has distance - A comes first
    if (distA !== undefined) return -1
    // Only B has distance - B comes first
    if (distB !== undefined) return 1
    
    // Neither has distance - maintain original order
    return 0
  })

  const handleBack = () => {
    navigate('/')
  }

  const handleCardClick = (centre) => {
    setSelectedCentre(centre)
    setModalOpen(true)
  }

  const handleCloseModal = () => {
    setModalOpen(false)
    setSelectedCentre(null)
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
      }}
    >
      {/* Sticky Header Section */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          bgcolor: 'background.default',
          zIndex: 10,
          borderBottom: '1px solid rgba(0,0,0,0.08)',
        }}
      >
        <Container
          maxWidth={false}
          sx={{
            py: 1.5,
            px: 2,
            maxWidth: '420px',
            margin: '0 auto',
          }}
        >
          {/* Back Button */}
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={handleBack}
            sx={{
              mb: 1,
              color: '#3d3d3d',
              textTransform: 'none',
              fontSize: '14px',
              fontWeight: 500,
              '&:hover': {
                bgcolor: 'transparent',
              },
            }}
          >
            Back to filters
          </Button>

          {/* Title */}
          <Typography
            variant="h1"
            sx={{
              color: '#3d3d3d',
              mb: 1,
              fontSize: '20px',
              fontWeight: 700,
            }}
          >
            Tuition Centres
          </Typography>

          {/* Filter Chips */}
          <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
            {isCentreNameMode && (
              <Chip
                label={`Centre: ${centreName}`}
                size="small"
                sx={{
                  bgcolor: '#e3f2fd',
                  color: '#1565c0',
                  fontWeight: 500,
                }}
              />
            )}
            {isLevelSubjectMode && level && (
              <Chip
                label={level}
                size="small"
                sx={{
                  bgcolor: '#e8f5e9',
                  color: '#2c4a3a',
                  fontWeight: 500,
                }}
              />
            )}
            {isLevelSubjectMode && subject && (
              <Chip
                label={subject}
                size="small"
                sx={{
                  bgcolor: '#e8f5e9',
                  color: '#2c4a3a',
                  fontWeight: 500,
                }}
              />
            )}
          </Box>

          {/* Results Count */}
          <Typography
            variant="body2"
            sx={{
              color: '#888888',
              fontSize: '13px',
              mb: 1,
            }}
          >
            {centres.length} centre{centres.length !== 1 ? 's' : ''} found
          </Typography>

          {/* Location Bar */}
          <Box sx={{ mb: 0.5 }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <TextField
                inputRef={locationInputRef}
                placeholder="Enter your location"
                value={locationInput}
                onChange={handleLocationInputChange}
                onKeyDown={handleKeyPress}
                size="small"
                sx={{
                  flex: 1,
                  '& .MuiOutlinedInput-root': {
                    fontSize: '13px',
                    bgcolor: '#ffffff',
                  }
                }}
              />
              <Button
                startIcon={<SearchIcon />}
                onClick={handleSearchByAddress}
                size="small"
                variant="contained"
                sx={{
                  textTransform: 'none',
                  fontSize: '12px',
                  whiteSpace: 'nowrap',
                  minWidth: 'auto',
                  px: 1.5,
                  bgcolor: '#4caf50',
                  '&:hover': {
                    bgcolor: '#45a049',
                  }
                }}
              >
                Search
              </Button>
              <Button
                startIcon={<MyLocationIcon />}
                onClick={handleUseCurrentLocation}
                size="small"
                variant="outlined"
                sx={{
                  textTransform: 'none',
                  fontSize: '12px',
                  whiteSpace: 'nowrap',
                  minWidth: 'auto',
                  px: 1.5,
                }}
              >
                Current
              </Button>
            </Box>
            <Typography
              variant="caption"
              sx={{
                color: '#888888',
                fontSize: '11px',
                display: 'block',
                mt: 0.5,
              }}
            >
              Used to sort by distance
            </Typography>
            {locationError && (
              <Alert severity="warning" sx={{ mt: 1, py: 0, fontSize: '12px' }}>
                {locationError}
              </Alert>
            )}
            {isGeocodingCentres && (
              <Typography
                variant="caption"
                sx={{
                  color: '#666666',
                  fontSize: '11px',
                  display: 'block',
                  mt: 0.5,
                }}
              >
                Calculating distances...
              </Typography>
            )}
          </Box>
        </Container>
      </Box>

      {/* Scrollable Results List */}
      <Container
        maxWidth={false}
        sx={{
          py: 2,
          px: 2,
          maxWidth: '420px',
          margin: '0 auto',
          position: 'relative',
          minHeight: '50vh',
        }}
      >
        {/* Empty state when no location */}
        {!parentLocation ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '50vh',
              textAlign: 'center',
              px: 3,
            }}
          >
            <Typography
              variant="h6"
              sx={{
                color: '#3d3d3d',
                fontWeight: 600,
                mb: 1,
                fontSize: '18px',
              }}
            >
              Enter your location to view nearby centres
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: '#888888',
                fontSize: '14px',
              }}
            >
              Use current location or type your address.
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              pb: 3,
            }}
          >
          {sortedCentres.map((centre) => {
            // Get the note that matches the current search criteria (only for level+subject mode)
            const matchingNote = isLevelSubjectMode ? getMatchingNote(centre, level, subject) : null;
            // Get subjects offered by this centre at the selected level (only for level+subject mode)
            const subjectsAtLevel = isLevelSubjectMode ? getSubjectsForCentreAtLevel(centre, level) : centre.subjects;
            // Get distance if available
            const distance = centreDistances.get(centre.name);

            return (
            <Card
              key={centre.name}
              onClick={() => handleCardClick(centre)}
              sx={{
                bgcolor: '#ffffff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                borderRadius: 1,
                cursor: 'pointer',
                '&:hover': {
                  boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                },
              }}
            >
              <CardContent>
                <Typography
                  variant="h6"
                  sx={{
                    fontSize: '16px',
                    fontWeight: 600,
                    color: '#3d3d3d',
                    mb: 1,
                  }}
                >
                  {centre.name}
                </Typography>

                {matchingNote && (
                  <Typography
                    variant="body2"
                    sx={{
                      color: '#666666',
                      mb: 1,
                      fontSize: '13px',
                    }}
                  >
                    {matchingNote}
                  </Typography>
                )}

                <Typography
                  variant="body2"
                  sx={{
                    color: '#888888',
                    fontSize: '12px',
                    mb: 0.5,
                  }}
                >
                  {formatSgAddress(centre.address, centre.postalCode)}
                </Typography>

                {/* Distance Display */}
                {parentLocation && (
                  <Typography
                    variant="body2"
                    sx={{
                      color: distance !== undefined ? '#4caf50' : '#cccccc',
                      fontSize: '12px',
                      fontWeight: 500,
                      mb: 1,
                    }}
                  >
                    {distance !== undefined ? `${distance.toFixed(1)} km away` : '...'}
                  </Typography>
                )}

                <Box>
                  <Typography
                    variant="caption"
                    sx={{
                      color: '#888888',
                      fontSize: '11px',
                      fontWeight: 600,
                      display: 'block',
                      mb: 0.5,
                    }}
                  >
                    Subjects:
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {subjectsAtLevel.map((subj) => (
                      <Chip
                        key={subj}
                        label={subj}
                        size="small"
                        sx={{
                          fontSize: '11px',
                          height: '20px',
                          bgcolor: '#f5f5f5',
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          )})}
        </Box>
        )}
      </Container>

      <CentreModal
        centre={selectedCentre}
        open={modalOpen}
        onClose={handleCloseModal}
        level={isCentreNameMode ? null : level}
        subject={isCentreNameMode ? null : subject}
      />
    </Box>
  )
}

export default ResultsPage
