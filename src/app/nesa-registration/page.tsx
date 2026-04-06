'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Users, Trophy, Gamepad2, Target, Clock } from 'lucide-react';

interface RegistrationStep {
  id: string;
  title: string;
  description: string;
  icon: any;
}

const steps: RegistrationStep[] = [
  {
    id: 'personal',
    title: 'Personal Information',
    description: 'Basic details and academic information',
    icon: Users
  },
  {
    id: 'sports',
    title: 'Sport Selection',
    description: 'Choose which sports to participate in',
    icon: Trophy
  },
  {
    id: 'details',
    title: 'Sport Details',
    description: 'Sport-specific information and preferences',
    icon: Target
  },
  {
    id: 'verification',
    title: 'Eligibility Verification',
    description: 'Economics department verification',
    icon: Clock
  }
];

const sports = [
  { id: 'football-male', name: 'Male Football (11v11)', icon: '⚽', maxPlayers: 16 },
  { id: 'football-female', name: 'Female Football (5v5)', icon: '⚽', maxPlayers: 8 },
  { id: 'basketball-male', name: 'Male Basketball', icon: '🏀', maxPlayers: 10 },
  { id: 'track-100m', name: '100m Track', icon: '🏃', maxPlayers: 1 },
  { id: 'track-200m', name: '200m Track', icon: '🏃', maxPlayers: 1 },
  { id: 'track-400m', name: '400m Track', icon: '🏃', maxPlayers: 1 },
  { id: 'fc26-singles', name: 'FC26 Singles', icon: '🎮', maxPlayers: 1 },
  { id: 'fc26-doubles', name: 'FC26 Doubles', icon: '🎮', maxPlayers: 2 },
  { id: 'cod-mobile', name: 'Call of Duty Mobile', icon: '🎯', maxPlayers: 4 },
  { id: 'efootball-mobile', name: 'eFootball Mobile', icon: '⚽', maxPlayers: 4 }
];

const universities = [
  'Bells University of Technology',
  'Anchor University',
  'Crawford University',
  'Caleb University',
  'Crescent University',
  'Trinity University',
  'Babcock University'
];

export default function NESARegistration() {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    // Personal Info
    fullName: '',
    jerseyName: '',
    email: '',
    age: '',
    nationality: 'Nigerian',
    height: '',
    weight: '',
    
    // Academic Info
    university: '',
    department: 'Economics',
    studentId: '',
    
    // Sport Details
    jerseyNumber: '',
    position: '',
    gamerTag: '',
    trackEvents: [] as string[],
    
    // Verification
    studentIdCard: null as File | null,
    economicsProof: null as File | null
  });

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleSport = (sportId: string) => {
    setSelectedSports(prev => 
      prev.includes(sportId) 
        ? prev.filter(s => s !== sportId)
        : [...prev, sportId]
    );
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderStep = () => {
    const step = steps[currentStep];
    
    switch (step.id) {
      case 'personal':
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold mb-4">Personal Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Full Name *</label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => updateFormData('fullName', e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary"
                  placeholder="Enter your full name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Jersey Name</label>
                <input
                  type="text"
                  value={formData.jerseyName}
                  onChange={(e) => updateFormData('jerseyName', e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary"
                  placeholder="Preferred jersey name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateFormData('email', e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary"
                  placeholder="your.email@university.edu"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Age *</label>
                <input
                  type="number"
                  value={formData.age}
                  onChange={(e) => updateFormData('age', e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary"
                  placeholder="20"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">University *</label>
                <select
                  value={formData.university}
                  onChange={(e) => updateFormData('university', e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary"
                >
                  <option value="">Select your university</option>
                  {universities.map(uni => (
                    <option key={uni} value={uni}>{uni}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Department *</label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => updateFormData('department', e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary"
                  placeholder="Economics"
                  disabled
                />
                <p className="text-xs text-white/40 mt-1">Must be Economics for NESA eligibility</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Student ID *</label>
                <input
                  type="text"
                  value={formData.studentId}
                  onChange={(e) => updateFormData('studentId', e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary"
                  placeholder="Your student ID number"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Nationality</label>
                <input
                  type="text"
                  value={formData.nationality}
                  onChange={(e) => updateFormData('nationality', e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary"
                  placeholder="Nigerian"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Height (optional)</label>
                <input
                  type="text"
                  value={formData.height}
                  onChange={(e) => updateFormData('height', e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary"
                  placeholder="6'0&quot;"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Weight (optional)</label>
                <input
                  type="text"
                  value={formData.weight}
                  onChange={(e) => updateFormData('weight', e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary"
                  placeholder="180lbs"
                />
              </div>
            </div>
          </div>
        );
        
      case 'sports':
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold mb-4">Select Sports to Participate In</h3>
            <p className="text-white/60">You can register for multiple sports. Note the limits per university.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sports.map(sport => (
                <div
                  key={sport.id}
                  onClick={() => toggleSport(sport.id)}
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    selectedSports.includes(sport.id)
                      ? 'border-primary bg-primary/10'
                      : 'border-white/20 hover:border-white/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{sport.icon}</span>
                      <div>
                        <h4 className="font-medium">{sport.name}</h4>
                        <p className="text-xs text-white/60">Max: {sport.maxPlayers} players</p>
                      </div>
                    </div>
                    <div className={`w-4 h-4 rounded border-2 ${
                      selectedSports.includes(sport.id)
                        ? 'border-primary bg-primary'
                        : 'border-white/40'
                    }`} />
                  </div>
                </div>
              ))}
            </div>
            
            {selectedSports.length > 0 && (
              <div className="p-4 bg-primary/10 border border-primary rounded-lg">
                <p className="text-sm">Selected: {selectedSports.length} sport(s)</p>
              </div>
            )}
          </div>
        );
        
      case 'details':
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold mb-4">Sport-Specific Details</h3>
            
            {selectedSports.includes('football-male') || selectedSports.includes('football-female') || selectedSports.includes('basketball-male') ? (
              <div className="space-y-4">
                <h4 className="font-medium">Team Sports Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Jersey Number *</label>
                    <input
                      type="number"
                      value={formData.jerseyNumber}
                      onChange={(e) => updateFormData('jerseyNumber', e.target.value)}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary"
                      placeholder="10"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Position *</label>
                    <input
                      type="text"
                      value={formData.position}
                      onChange={(e) => updateFormData('position', e.target.value)}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary"
                      placeholder="Forward, Guard, etc."
                    />
                  </div>
                </div>
              </div>
            ) : null}
            
            {selectedSports.some(s => s.includes('fc26') || s.includes('cod') || s.includes('efootball')) ? (
              <div className="space-y-4">
                <h4 className="font-medium">Esports Information</h4>
                <div>
                  <label className="block text-sm font-medium mb-2">Gamer Tag *</label>
                  <input
                    type="text"
                    value={formData.gamerTag}
                    onChange={(e) => updateFormData('gamerTag', e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary"
                    placeholder="Your gaming username"
                  />
                </div>
              </div>
            ) : null}
            
            {selectedSports.some(s => s.includes('track')) ? (
              <div className="space-y-4">
                <h4 className="font-medium">Track Events</h4>
                <p className="text-white/60">Select which track events you want to participate in:</p>
                <div className="space-y-2">
                  {['track-100m', 'track-200m', 'track-400m'].filter(event => selectedSports.includes(event)).map(event => (
                    <label key={event} className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={formData.trackEvents.includes(event)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            updateFormData('trackEvents', [...formData.trackEvents, event]);
                          } else {
                            updateFormData('trackEvents', formData.trackEvents.filter(t => t !== event));
                          }
                        }}
                        className="rounded"
                      />
                      <span>{event.replace('track-', '').replace('-', 'm')}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        );
        
      case 'verification':
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold mb-4">Eligibility Verification</h3>
            <p className="text-white/60">Please upload documents to verify your Economics department enrollment</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Student ID Card *</label>
                <input
                  type="file"
                  onChange={(e) => updateFormData('studentIdCard', e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary"
                  accept="image/*,.pdf"
                />
                <p className="text-xs text-white/40 mt-1">Upload your student ID card</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Economics Department Proof *</label>
                <input
                  type="file"
                  onChange={(e) => updateFormData('economicsProof', e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary"
                  accept="image/*,.pdf"
                />
                <p className="text-xs text-white/40 mt-1">Course registration form, department letter, or similar</p>
              </div>
            </div>
            
            <div className="p-4 bg-yellow-500/10 border border-yellow-500 rounded-lg">
              <p className="text-sm">
                <strong>Important:</strong> Your registration will be reviewed by NESA officials. 
                You'll receive an email once your Economics department enrollment is verified.
              </p>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">NESA Inter-School Sports Festival 2026</h1>
          <p className="text-white/60">Registration for Economics Students</p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  index <= currentStep ? 'bg-primary' : 'bg-white/10'
                }`}>
                  <step.icon size={20} />
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-16 h-0.5 mx-2 ${
                    index < currentStep ? 'bg-primary' : 'bg-white/10'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2">
            {steps.map((step, index) => (
              <div key={step.id} className={`text-xs ${
                index <= currentStep ? 'text-primary' : 'text-white/40'
              }`}>
                {step.title}
              </div>
            ))}
          </div>
        </div>

        {/* Current Step */}
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 border border-white/10 rounded-xl p-6"
        >
          {renderStep()}
        </motion.div>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <button
            onClick={prevStep}
            disabled={currentStep === 0}
            className="px-6 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            Previous
          </button>
          
          {currentStep < steps.length - 1 ? (
            <button
              onClick={nextStep}
              className="px-6 py-2 bg-primary hover:bg-primary/80 rounded-lg transition-colors flex items-center gap-2"
            >
              Next
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              onClick={() => {
                // Submit registration
                console.log('Submitting registration:', formData, selectedSports);
                alert('Registration submitted! You will receive an email after verification.');
              }}
              className="px-6 py-2 bg-primary hover:bg-primary/80 rounded-lg transition-colors"
            >
              Submit Registration
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
