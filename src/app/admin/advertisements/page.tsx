'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Eye, EyeOff, Image as ImageIcon, X, Upload, DollarSign, Layout, Maximize } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import Script from 'next/script';

// Payment tiers with allowed positions and sizes
const PAYMENT_TIERS = {
  basic: {
    name: 'Basic ($50/month)',
    positions: ['inline'],
    sizes: ['small'],
    priority: 1,
  },
  standard: {
    name: 'Standard ($150/month)',
    positions: ['inline', 'sidebar'],
    sizes: ['small', 'medium'],
    priority: 5,
  },
  premium: {
    name: 'Premium ($300/month)',
    positions: ['inline', 'sidebar', 'bottom'],
    sizes: ['small', 'medium', 'large'],
    priority: 10,
  },
  platinum: {
    name: 'Platinum ($500/month)',
    positions: ['inline', 'sidebar', 'bottom', 'top'],
    sizes: ['small', 'medium', 'large'],
    priority: 20,
  },
};

interface Advertisement {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string;
  linkUrl: string;
  position: 'top' | 'bottom' | 'sidebar' | 'inline';
  size: 'small' | 'medium' | 'large';
  status: 'active' | 'inactive';
  priority: number;
  startDate: number | null;
  endDate: number | null;
  impressions: number;
  clicks: number;
  createdAt: number;
}

export default function AdvertisementsAdmin() {
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<Advertisement | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    imageUrl: '',
    linkUrl: '',
    position: 'inline' as 'inline' | 'sidebar' | 'bottom' | 'top',
    size: 'small' as 'small' | 'medium' | 'large',
    status: 'active' as 'active' | 'inactive',
    priority: 0,
    startDate: '',
    endDate: '',
    paymentTier: 'basic' as 'basic' | 'standard' | 'premium' | 'platinum',
  });

  useEffect(() => {
    fetchAds();
  }, []);

  const fetchAds = async () => {
    try {
      const response = await fetch('/api/admin/ads');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAds(data.ads);
        }
      }
    } catch (error) {
      console.error('Error fetching ads:', error);
      toast.error('Failed to load advertisements');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const url = editingAd ? `/api/admin/ads/${editingAd.id}` : '/api/admin/ads';
      const method = editingAd ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          startDate: formData.startDate ? new Date(formData.startDate).getTime() : null,
          endDate: formData.endDate ? new Date(formData.endDate).getTime() : null,
        }),
      });

      if (response.ok) {
        toast.success(editingAd ? 'Advertisement updated' : 'Advertisement created');
        setIsDialogOpen(false);
        resetForm();
        fetchAds();
      } else {
        toast.error('Failed to save advertisement');
      }
    } catch (error) {
      console.error('Error saving ad:', error);
      toast.error('Failed to save advertisement');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this advertisement?')) return;

    try {
      const response = await fetch(`/api/admin/ads/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Advertisement deleted');
        fetchAds();
      } else {
        toast.error('Failed to delete advertisement');
      }
    } catch (error) {
      console.error('Error deleting ad:', error);
      toast.error('Failed to delete advertisement');
    }
  };

  const handleToggleStatus = async (ad: Advertisement) => {
    try {
      const response = await fetch(`/api/admin/ads/${ad.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: ad.status === 'active' ? 'inactive' : 'active',
        }),
      });

      if (response.ok) {
        toast.success(`Advertisement ${ad.status === 'active' ? 'paused' : 'activated'}`);
        fetchAds();
      } else {
        toast.error('Failed to update advertisement');
      }
    } catch (error) {
      console.error('Error toggling ad status:', error);
      toast.error('Failed to update advertisement');
    }
  };

  const resetForm = () => {
    setEditingAd(null);
    setFormData({
      title: '',
      description: '',
      imageUrl: '',
      linkUrl: '',
      position: 'inline' as 'inline' | 'sidebar' | 'bottom' | 'top',
      size: 'small' as 'small' | 'medium' | 'large',
      status: 'active' as 'active' | 'inactive',
      priority: 0,
      startDate: '',
      endDate: '',
      paymentTier: 'basic' as 'basic' | 'standard' | 'premium' | 'platinum',
    });
  };

  const openEditDialog = (ad: Advertisement) => {
    setEditingAd(ad);
    setFormData({
      title: ad.title,
      description: ad.description || '',
      imageUrl: ad.imageUrl,
      linkUrl: ad.linkUrl,
      position: ad.position,
      size: ad.size,
      status: ad.status,
      priority: ad.priority,
      startDate: ad.startDate ? format(new Date(ad.startDate), 'yyyy-MM-dd') : '',
      endDate: ad.endDate ? format(new Date(ad.endDate), 'yyyy-MM-dd') : '',
      paymentTier: getTierFromPriority(ad.priority),
    });
    setIsDialogOpen(true);
  };

  const getTierFromPriority = (priority: number): keyof typeof PAYMENT_TIERS => {
    if (priority >= 20) return 'platinum';
    if (priority >= 10) return 'premium';
    if (priority >= 5) return 'standard';
    return 'basic';
  };

  const getRecommendedAspectRatio = (position: string): number => {
    switch (position) {
      case 'top':
      case 'bottom':
        return 728 / 90; // Leaderboard banner
      case 'sidebar':
        return 300 / 600; // Skyscraper
      case 'inline':
      default:
        return 300 / 250; // Medium rectangle
    }
  };

  const getRecommendedDimensions = (position: string): string => {
    switch (position) {
      case 'top':
      case 'bottom':
        return '728x90 (Leaderboard)';
      case 'sidebar':
        return '300x600 (Skyscraper)';
      case 'inline':
      default:
        return '300x250 (Medium Rectangle)';
    }
  };

  const handleTierChange = (tier: keyof typeof PAYMENT_TIERS) => {
    const tierConfig = PAYMENT_TIERS[tier];
    setFormData({
      ...formData,
      paymentTier: tier as 'basic' | 'standard' | 'premium' | 'platinum',
      position: tierConfig.positions[0] as 'inline' | 'sidebar' | 'bottom' | 'top',
      size: tierConfig.sizes[0] as 'small' | 'medium' | 'large',
      priority: tierConfig.priority,
    });
  };

  const positionLabels: Record<string, string> = {
    top: 'Top Banner',
    bottom: 'Bottom Banner',
    sidebar: 'Sidebar',
    inline: 'Inline',
  };

  const sizeLabels: Record<string, string> = {
    small: 'Small',
    medium: 'Medium',
    large: 'Large',
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Advertisements</h1>
          <p className="text-muted-foreground">Manage banner ads across the platform</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              Add Advertisement
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingAd ? 'Edit Advertisement' : 'Create Advertisement'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              
              <div>
                <Label htmlFor="paymentTier" className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Payment Tier
                </Label>
                <Select
                  value={formData.paymentTier}
                  onValueChange={(value: keyof typeof PAYMENT_TIERS) => handleTierChange(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAYMENT_TIERS).map(([key, tier]) => (
                      <SelectItem key={key} value={key}>
                        {tier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Determines available positions, sizes, and priority
                </p>
              </div>

              <div>
                <Label className="flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Banner Image
                </Label>
                {formData.imageUrl ? (
                  <div className="relative w-full h-48 rounded-md overflow-hidden bg-slate-800 mt-2">
                    <div className="absolute top-2 right-2 z-10">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, imageUrl: '' })}
                        className="p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <img
                      src={formData.imageUrl}
                      alt="Ad preview"
                      className="object-cover w-full h-full"
                    />
                  </div>
                ) : (
                  <>
                    {/* Cloudinary Upload Widget */}
                    <Script
                      src="https://upload-widget.cloudinary.com/global/all.js"
                      strategy="lazyOnload"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'drlwegsiz';
                        const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'brix_uploads';
                        
                        if (!cloudName) {
                          toast.error('Cloudinary not configured');
                          return;
                        }
                        
                        if ((window as any).cloudinary) {
                          const widget = (window as any).cloudinary.createUploadWidget(
                            {
                              cloudName,
                              uploadPreset,
                              maxFiles: 1,
                              cropping: true,
                              croppingAspectRatio: getRecommendedAspectRatio(formData.position),
                            },
                            (error: any, result: any) => {
                              if (error) {
                                console.error('Upload error:', error);
                                toast.error('Upload failed');
                              }
                              if (result?.event === 'success') {
                                setFormData({ ...formData, imageUrl: result.info.secure_url });
                                toast.success('Image uploaded!');
                              }
                            }
                          );
                          widget.open();
                        } else {
                          toast.error('Upload widget loading... Please try again.');
                        }
                      }}
                      className="w-full h-32 rounded-md border-2 border-dashed border-slate-600 bg-slate-800/50 hover:bg-slate-700 hover:border-slate-500 transition flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-white mt-2"
                    >
                      <Upload className="w-8 h-8" />
                      <span className="font-semibold text-sm">Click to Upload Image</span>
                      <span className="text-xs text-slate-500">Cloudinary Upload</span>
                    </button>

                    {/* Image URL Input */}
                    <div className="mt-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                      <Label className="text-xs text-slate-400 flex items-center gap-2">
                        <ImageIcon className="w-3 h-3" />
                        Or paste image URL:
                      </Label>
                      <div className="flex gap-2 mt-2">
                        <Input
                          type="url"
                          placeholder="https://example.com/image.jpg"
                          value={formData.imageUrl}
                          onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                          className="flex-1 bg-slate-900 border-slate-600"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
              
              <div>
                <Label htmlFor="linkUrl">Link URL</Label>
                <Input
                  id="linkUrl"
                  value={formData.linkUrl}
                  onChange={(e) => setFormData({ ...formData, linkUrl: e.target.value })}
                  required
                  placeholder="https://example.com"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="position" className="flex items-center gap-2">
                    <Layout className="w-4 h-4" />
                    Position
                  </Label>
                  <Select
                    value={formData.position}
                    onValueChange={(value: any) => setFormData({ ...formData, position: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_TIERS[formData.paymentTier].positions.map((pos) => (
                        <SelectItem key={pos} value={pos}>
                          {positionLabels[pos]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="size" className="flex items-center gap-2">
                    <Maximize className="w-4 h-4" />
                    Size
                  </Label>
                  <Select
                    value={formData.size}
                    onValueChange={(value: any) => setFormData({ ...formData, size: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_TIERS[formData.paymentTier].sizes.map((sz) => (
                        <SelectItem key={sz} value={sz}>
                          {sizeLabels[sz]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Input
                    id="priority"
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                    min={0}
                  />
                </div>
                
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: any) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>
              </div>
              
              <Button type="submit" className="w-full">
                {editingAd ? 'Update Advertisement' : 'Create Advertisement'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : ads.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ImageIcon className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No advertisements yet</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setIsDialogOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create your first ad
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {ads.map((ad) => (
            <Card key={ad.id}>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-24 h-16 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                    {ad.imageUrl ? (
                      <img
                        src={ad.imageUrl}
                        alt={ad.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold truncate">{ad.title}</h3>
                        {ad.description && (
                          <p className="text-sm text-muted-foreground truncate">
                            {ad.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleStatus(ad)}
                        >
                          {ad.status === 'active' ? (
                            <Eye className="w-4 h-4" />
                          ) : (
                            <EyeOff className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(ad)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(ad.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                        {positionLabels[ad.position]}
                      </span>
                      <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                        {sizeLabels[ad.size]}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        ad.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {ad.status}
                      </span>
                      {ad.priority > 0 && (
                        <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
                          Priority: {ad.priority}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                      <span>Impressions: {ad.impressions.toLocaleString()}</span>
                      <span>Clicks: {ad.clicks.toLocaleString()}</span>
                      {ad.startDate && (
                        <span>From: {format(new Date(ad.startDate), 'MMM d, yyyy')}</span>
                      )}
                      {ad.endDate && (
                        <span>To: {format(new Date(ad.endDate), 'MMM d, yyyy')}</span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
