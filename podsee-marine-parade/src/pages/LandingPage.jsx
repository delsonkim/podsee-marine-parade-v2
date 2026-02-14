import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Container,
  Box,
  Typography,
  Button,
  CircularProgress,
  TextField,
  Autocomplete,
  Divider,
} from '@mui/material'
import MaterialChipSelector from '../components/MaterialChipSelector'
import { loadCentresData, getFilterOptions, getSubjectsForLevel } from '../utils/dataLoader'

function LandingPage() {
  const [level, setLevel] = useState('')
  const [subject, setSubject] = useState('')
  const [centreName, setCentreName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [filterOptions, setFilterOptions] = useState({ levels: [], subjects: [] })
  const [centres, setCentres] = useState([])
  const [validSubjects, setValidSubjects] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    loadCentresData()
      .then(centresData => {
        setCentres(centresData);
        const options = getFilterOptions(centresData);
        setFilterOptions(options);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load data:', err);
        setError('Failed to load data. Please refresh the page.');
        setLoading(false);
      });
  }, [])

  // Update valid subjects when level changes
  useEffect(() => {
    if (level) {
      const subjects = getSubjectsForLevel(level, centres);
      setValidSubjects(subjects);
      
      // Clear subject if it's not valid for the new level
      if (subject && !subjects.includes(subject)) {
        setSubject('');
      }
    } else {
      setValidSubjects([]);
      setSubject('');
    }
  }, [level, centres])

  const handleSearchByLevelSubject = () => {
    if (!level || !subject) {
      setError('Please select a level and subject.')
      return
    }
    setError('')
    navigate(`/results?level=${level}&subject=${subject}`)
  }

  const handleSearchByCentre = () => {
    if (!centreName) {
      setError('Please enter a centre name.')
      return
    }
    setError('')
    navigate(`/results?centre=${encodeURIComponent(centreName)}`)
  }

  const handleSearch = () => {
    // Determine which search method to use based on what's filled
    if (centreName) {
      handleSearchByCentre()
    } else if (level && subject) {
      handleSearchByLevelSubject()
    } else {
      setError('Please search by centre name OR select level and subject.')
    }
  }

  const handleWhatsApp = () => {
    const message = encodeURIComponent(
      "Hi Delson — I'm interested in Podsee to be part of the community of parents for tuition and am reaching out to you to contribute as much as possible to make this happen!"
    )
    window.open(`https://wa.me/6596772033?text=${message}`, '_blank')
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Container
        maxWidth={false}
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          py: 1.5,
          px: 2,
          maxWidth: '420px',
          margin: '0 auto',
        }}
      >
        {/* Logo Header */}
        <Box sx={{ textAlign: 'center', my: 2 }}>
          <Box
            component="img"
            src="/podsee-logo.jpg"
            alt="Podsee"
            sx={{
              height: 90,
              width: 'auto',
              bgcolor: '#f5f1e8',
            }}
          />
        </Box>

        {/* Hero Section */}
        <Box sx={{ textAlign: 'center', mb: 2.5 }}>
          <Typography
            variant="h1"
            sx={{
              color: '#3d3d3d',
              mb: 0.5,
              fontSize: '18px',
              fontWeight: 700,
              lineHeight: 1.3,
            }}
          >
            Every tuition centre in Marine Parade Here
          </Typography>
          <Typography 
            variant="subtitle1" 
            sx={{ 
              color: '#888888',
              fontSize: '13px',
            }}
          >
            Filter and Search!
          </Typography>
        </Box>

        {/* Search Section */}
        <Box sx={{ mb: 2 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {/* Centre Name Search */}
              <Box sx={{ mb: 2 }}>
                <Autocomplete
                  freeSolo
                  options={centres.map(c => c.name)}
                  value={centreName}
                  onChange={(event, newValue) => {
                    setCentreName(newValue || '')
                    // Clear level/subject when centre is selected
                    if (newValue) {
                      setLevel('')
                      setSubject('')
                    }
                  }}
                  onInputChange={(event, newValue) => {
                    setCentreName(newValue || '')
                    // Clear level/subject when typing centre name
                    if (newValue) {
                      setLevel('')
                      setSubject('')
                    }
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Search by centre name"
                      variant="outlined"
                      size="small"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          fontSize: '14px',
                          bgcolor: '#ffffff',
                        }
                      }}
                    />
                  )}
                />
              </Box>

              {/* Divider */}
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Divider sx={{ flex: 1, borderColor: 'rgba(0, 0, 0, 0.2)' }} />
                <Typography sx={{ px: 2, color: '#888888', fontSize: '12px', fontWeight: 500 }}>
                  OR
                </Typography>
                <Divider sx={{ flex: 1, borderColor: 'rgba(0, 0, 0, 0.2)' }} />
              </Box>

              {/* Level + Subject Filters */}
              <MaterialChipSelector
                label="Select Level"
                options={filterOptions.levels}
                value={level}
                onChange={(newLevel) => {
                  setLevel(newLevel)
                  // Clear centre name when level is selected
                  if (newLevel) {
                    setCentreName('')
                  }
                }}
              />

              <MaterialChipSelector
                label="Select Subject"
                options={validSubjects}
                value={subject}
                onChange={(newSubject) => {
                  setSubject(newSubject)
                  // Clear centre name when subject is selected
                  if (newSubject) {
                    setCentreName('')
                  }
                }}
                disabled={!level}
                helperText={!level ? 'Select level first' : ''}
              />
            </>
          )}

          {error && (
            <Typography
              variant="body2"
              sx={{
                color: 'error.main',
                textAlign: 'center',
                mt: 0.5,
                fontSize: '12px',
              }}
            >
              {error}
            </Typography>
          )}
        </Box>

        {/* Search Button */}
        <Button
          variant="contained"
          size="large"
          fullWidth
          onClick={handleSearch}
          sx={{
            py: 1,
            mb: 3,
            fontSize: '14px',
            fontWeight: 600,
            borderRadius: 50,
            textTransform: 'none',
            bgcolor: (centreName || (level && subject)) ? '#2c4a3a' : 'rgba(0, 0, 0, 0.12)',
            color: (centreName || (level && subject)) ? '#ffffff' : 'rgba(0, 0, 0, 0.26)',
            boxShadow: 'none',
            border: 'none',
            '&:hover': {
              bgcolor: (centreName || (level && subject)) ? '#1f3a0f' : 'rgba(0, 0, 0, 0.15)',
              boxShadow: 'none',
            },
            '&:active': {
              boxShadow: 'none',
            },
          }}
        >
          Search
        </Button>

        {/* CTA Section */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography
            variant="h2"
            sx={{
              color: '#3d3d3d',
              mb: 1,
              lineHeight: 1.4,
              fontSize: '17px',
              fontWeight: 300,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            }}
          >
            Get access to parent recommendations, in your own community
          </Typography>
          <Typography
            variant="subtitle2"
            sx={{
              color: '#888888',
              mb: 2,
              lineHeight: 1.5,
              fontSize: '13px',
            }}
          >
            We're building a quiet parent community where tuition centres are shared
            through real experiences — not ads or rankings.
          </Typography>
          <Button
            variant="contained"
            size="large"
            fullWidth
            onClick={handleWhatsApp}
            sx={{
              py: 1,
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: 50,
              textTransform: 'none',
              boxShadow: 'none',
              bgcolor: '#2c4a3a',
              '&:hover': {
                bgcolor: '#1f3a0f',
                boxShadow: 'none',
              },
            }}
          >
            Share Your Thoughts with Me
          </Button>
        </Box>

        {/* Footer */}
        <Box
          sx={{
            textAlign: 'center',
            py: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
          }}
        >
          <Box
            component="img"
            src="/smu-logo.png"
            alt="SMU"
            sx={{
              width: 45,
              height: 'auto',
            }}
          />
          <Typography
            variant="body2"
            sx={{
              color: '#888888',
              fontStyle: 'italic',
              fontSize: '12px',
            }}
          >
            by SMU students
          </Typography>
        </Box>
      </Container>
    </Box>
  )
}

export default LandingPage
